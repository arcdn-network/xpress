const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildPool } = require('../utils/browser-pool');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function fixture(options = {}, overrides = {}) {
  const state = { launches: 0, closes: 0, pages: 0, peak: 0, activeOnClose: [] };
  const puppeteer = { launch: async () => {
    state.launches++;
    await delay(2);
    return { connected: true,
      close: async () => { state.activeOnClose.push(state.pages); state.closes++; },
      newPage: async () => {
        state.pages++;
        state.peak = Math.max(state.peak, state.pages);
        return { close: async () => { state.pages--; } };
      }, ...overrides,
    };
  } };
  return { state, pool: buildPool(puppeteer, {}, { timeoutMs: 200, closeTimeoutMs: 30, ...options }) };
}

test('simultaneous requests launch once and enforce shared concurrency', async () => {
  const { state, pool } = fixture();
  await Promise.all(Array.from({ length: 10 }, () => pool.withPage(async () => { await delay(5); })));
  assert.equal(state.launches, 1);
  assert.equal(state.peak, 3);
  assert.equal(state.pages, 0);
  await pool.close();
  assert.equal(state.closes, 1);
});

test('recycling waits for active pages and queued work continues', async () => {
  const { state, pool } = fixture({ restartAfter: 2 });
  await Promise.all(Array.from({ length: 5 }, () => pool.withPage(async () => { await delay(10); })));
  await pool.close();
  assert.equal(state.launches, 3);
  assert.deepEqual(state.activeOnClose, [0, 0, 0]);
});

test('queue is bounded and waiting jobs expire without running', async () => {
  const { pool } = fixture({ maxConcurrent: 1, maxQueue: 1, queueTimeoutMs: 10 });
  const first = pool.withPage(() => delay(40));
  const waiting = pool.withPage(() => assert.fail('expired job ran'));
  await assert.rejects(pool.withPage(() => {}), /ocupado/);
  await assert.rejects(waiting, /cola/);
  await first;
  await pool.close();
});

test('hung newPage times out, late page is cleaned and next work recovers', async () => {
  let lateClosed = 0;
  const { pool } = fixture({ timeoutMs: 15 }, {
    newPage: async () => { await delay(35); return { close: async () => { lateClosed++; } }; },
  });
  await assert.rejects(pool.withPage(() => assert.fail('late callback ran')), /Timeout/);
  await delay(40);
  assert.equal(lateClosed, 1);
  assert.equal(pool.stats().running, 0);
  await pool.close();
});

test('failed browser close stops replacement launches; external browser stays untouched', async () => {
  let externalClosed = false;
  const externalBrowser = { close: () => { externalClosed = true; } };
  const { pool, state } = fixture({ timeoutMs: 15 }, {
    close: () => new Promise(() => {}),
  });
  await assert.rejects(pool.withPage(() => new Promise(() => {})), /Timeout/);
  await delay(50);
  assert.equal(pool.stats().stopped, true);
  await assert.rejects(pool.withPage(() => {}), /detenido/);
  assert.equal(state.launches, 1);
  assert.equal(externalClosed, false);
  assert.ok(externalBrowser);
});

test('external persistent profiles cannot be supplied', () => {
  for (const options of [{ userDataDir: '/whatsapp' }, { browserWSEndpoint: 'ws://external' },
    { args: ['--user-data-dir=/whatsapp'] }]) {
    assert.throws(() => buildPool({}, options), /perfil temporal/);
  }
});

test('service factory returns the same pool', async () => {
  const { createBrowserPool } = require('../utils/browser');
  const first = createBrowserPool();
  assert.equal(createBrowserPool(), first);
  await first.close();
});
