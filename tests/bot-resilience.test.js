const { test } = require('node:test');
const assert = require('node:assert/strict');
const TelegramBot = require('node-telegram-bot-api');
const { installBotResilience, errorSummary } = require('../utils/bot-resilience');

function fixture() {
  const bot = new TelegramBot('test', {
    polling: { autoStart: false, interval: 1000 },
  });
  bot.getUpdates = async () => [];
  const errors = [];
  installBotResilience(bot, { error: (text) => errors.push(text), info() {} });
  return { bot, errors };
}

test('command and event failures are contained, including failed error replies', async () => {
  const { bot, errors } = fixture();
  const handler = async () => {
    try { throw new Error('API unavailable'); }
    catch { await Promise.reject(new Error('socket hang up')); }
  };
  bot.onText(/\/register/, handler);
  bot.on('callback_query', handler);
  bot.processUpdate({ update_id: 1, message: { text: '/register', chat: { id: 1 } } });
  bot.emit('callback_query', {});
  await new Promise(setImmediate);
  assert.equal(errors.length, 2);
  assert.ok(errors.every((text) => text.includes('socket hang up')));
});

test('polling respects retry_after, backs off and resets after successful empty poll', async () => {
  const { bot } = fixture();
  bot.emit('polling_error', {
    message: '429', response: { body: { parameters: { retry_after: 120 } } },
  });
  assert.equal(bot.options.polling.interval, 121000);
  await bot.getUpdates();
  assert.equal(bot.options.polling.interval, 1000);
  for (let i = 0; i < 10; i++) bot.emit('polling_error', new Error('ECONNRESET'));
  assert.equal(bot.options.polling.interval, 60000);
  await bot.getUpdates();
  assert.equal(bot.options.polling.interval, 1000);
});

test('error summary hides Telegram tokens', () => {
  assert.equal(errorSummary(new Error('https://api.telegram.org/bot123:secret/sendMessage')),
    'https://api.telegram.org/bot[REDACTED]/sendMessage');
});

test('register updates existing username through API instead of document.save', async () => {
  const api = require('../utils/api');
  const original = { getUser: api.getUser, updateUser: api.updateUser };
  const calls = [];
  api.getUser = async () => ({ username: 'old' });
  api.updateUser = async (...args) => calls.push(args);
  const path = require.resolve('../commands/start');
  delete require.cache[path];
  try {
    const register = require(path);
    const { bot, errors } = fixture();
    bot.sendMessage = async () => ({});
    register(bot);
    const update = { update_id: 2, message: {
      text: '/register', chat: { id: 1 }, from: { id: 1, username: 'new' },
    } };
    bot.processUpdate(update);
    bot.processUpdate(update);
    await new Promise(setImmediate);
    assert.deepEqual(calls, [[1, { username: 'new' }]]);
    assert.deepEqual(errors, []);
    // Even a failed Telegram reply must release the per-user registration lock.
    bot.sendMessage = async () => { throw new Error('network down'); };
    bot.processUpdate(update);
    await new Promise(setImmediate);
    bot.sendMessage = async () => ({});
    bot.processUpdate(update);
    await new Promise(setImmediate);
    assert.equal(calls.length, 3);
    assert.equal(errors.length, 1);
  } finally {
    Object.assign(api, original);
    delete require.cache[path];
  }
});
