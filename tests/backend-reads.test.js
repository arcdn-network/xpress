const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBackendReader } = require('../utils/backend-reads');
const outage = () => Object.assign(new Error('unavailable'), { response: { status: 503 } });
const logger = { info() {}, warn() {} };

test('transient read retries once and recovers, with bounded request timeouts', async () => {
  let calls = 0;
  let clock = 0;
  const read = createBackendReader({ get: async (url, config) => {
    assert.equal(config.timeout, 12000);
    assert.ok(config.signal);
    if (++calls === 1) { clock += 12000; throw outage(); }
    return { data: 'ok' };
  } }, { now: () => clock, sleep: async (ms) => { clock += ms; }, logger });
  assert.deepEqual(await read('/user'), { data: 'ok' });
  assert.equal(calls, 2);
  assert.equal(clock, 13000);
});

test('404, authentication and unrelated 500 errors retain their response and do not retry', async () => {
  for (const status of [404, 401, 403, 500]) {
    let calls = 0;
    const error = Object.assign(new Error('original'), { response: { status } });
    const read = createBackendReader({ get: async () => { calls++; throw error; } });
    await assert.rejects(read('/user'), (actual) => actual === error);
    assert.equal(calls, 1);
  }
});

test('Mongo buffering 500 retries but returns a controlled error when exhausted', async () => {
  let calls = 0;
  const read = createBackendReader({ get: async () => {
    calls++;
    throw { response: { status: 500, data: { msg: 'Operation users.findOne() buffering timed out after 10000ms' } } };
  } }, { sleep: async () => {}, logger });
  await assert.rejects(read('/user'), { code: 'BACKEND_UNAVAILABLE' });
  assert.equal(calls, 2);
});

test('circuit blocks reads, admits only one recovery probe and then resumes', async () => {
  let clock = 0;
  let calls = 0;
  let recover;
  let healthy = false;
  const read = createBackendReader({ get: async () => {
    calls++;
    if (!healthy) throw outage();
    return new Promise((resolve) => { recover = resolve; });
  } }, { now: () => clock, sleep: async () => {}, logger });
  for (let i = 0; i < 3; i++) await assert.rejects(read('/user'), { code: 'BACKEND_UNAVAILABLE' });
  assert.equal(calls, 6);
  await assert.rejects(read('/user'), { code: 'BACKEND_UNAVAILABLE' });
  assert.equal(calls, 6);
  clock = 20001;
  healthy = true;
  const probe = read('/user');
  await assert.rejects(read('/user'), { code: 'BACKEND_UNAVAILABLE' });
  assert.equal(calls, 7);
  recover({ data: 'recovered' });
  await probe;
  const next = read('/user');
  recover({ data: 'ok' });
  assert.deepEqual(await next, { data: 'ok' });
});

test('elapsed total budget prevents another network attempt', async () => {
  let clock = 0;
  let calls = 0;
  const read = createBackendReader({ get: async () => {
    calls++;
    clock = 25001;
    throw outage();
  } }, { now: () => clock, logger });
  await assert.rejects(read('/user'), { code: 'BACKEND_UNAVAILABLE' });
  assert.equal(calls, 1);
});
