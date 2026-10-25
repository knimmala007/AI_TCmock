import test from 'node:test';
import assert from 'node:assert';
import { memoryKv, upstashKv } from '../kv.js';

test('memory kv: get, set, list push, range, trim', async () => {
  const kv = memoryKv();
  assert.strictEqual(await kv.exec(['GET', 'a']), null);
  await kv.exec(['SET', 'a', 'x']);
  assert.strictEqual(await kv.exec(['GET', 'a']), 'x');
  await kv.exec(['RPUSH', 'l', '1', '2', '3', '4']);
  assert.deepStrictEqual(await kv.exec(['LRANGE', 'l', 0, -1]), ['1', '2', '3', '4']);
  await kv.exec(['LTRIM', 'l', -2, -1]);
  assert.deepStrictEqual(await kv.exec(['LRANGE', 'l', 0, -1]), ['3', '4']);
});

test('memory kv: keys expire', async () => {
  let t = 1000;
  const kv = memoryKv({ now: () => t });
  await kv.exec(['RPUSH', 'l', 'a']);
  await kv.exec(['EXPIRE', 'l', 60]);
  t += 59_000;
  assert.deepStrictEqual(await kv.exec(['LRANGE', 'l', 0, -1]), ['a']);
  t += 2_000;
  assert.deepStrictEqual(await kv.exec(['LRANGE', 'l', 0, -1]), []);
});

test('memory kv: a pipeline runs every command in order', async () => {
  const kv = memoryKv();
  const res = await kv.pipeline([['RPUSH', 'l', 'a'], ['RPUSH', 'l', 'b'], ['LRANGE', 'l', 0, -1]]);
  assert.deepStrictEqual(res, [1, 2, ['a', 'b']]);
});

test('memory kv: an unknown command is rejected', async () => {
  await assert.rejects(memoryKv().exec(['FLUSHALL']), /unsupported/);
});

function fakeFetch(responder) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => responder(url, JSON.parse(init.body)) };
  };
  return { fetch, calls };
}

test('upstash kv: sends one command as a JSON array with a bearer token', async () => {
  const { fetch, calls } = fakeFetch(() => ({ result: 'OK' }));
  const kv = upstashKv({ url: 'https://x.upstash.io', token: 'tok', fetch });
  assert.strictEqual(await kv.exec(['SET', 'k', 'v']), 'OK');
  assert.strictEqual(calls[0].url, 'https://x.upstash.io');
  assert.deepStrictEqual(calls[0].body, ['SET', 'k', 'v']);
  assert.strictEqual(calls[0].init.headers.Authorization, 'Bearer tok');
});

test('upstash kv: a pipeline goes to /pipeline and returns each result', async () => {
  const { fetch, calls } = fakeFetch(() => [{ result: 1 }, { result: 'OK' }]);
  const kv = upstashKv({ url: 'https://x.upstash.io/', token: 'tok', fetch });
  assert.deepStrictEqual(await kv.pipeline([['RPUSH', 'l', 'a'], ['EXPIRE', 'l', 60]]), [1, 'OK']);
  assert.strictEqual(calls[0].url, 'https://x.upstash.io/pipeline');
});

test('upstash kv: errors throw, and the token never appears in the message', async () => {
  const { fetch } = fakeFetch(() => ({ error: 'ERR boom' }));
  const kv = upstashKv({ url: 'https://x.upstash.io', token: 'super-secret', fetch });
  await assert.rejects(kv.exec(['GET', 'k']), e => /ERR boom/.test(e.message) && !e.message.includes('super-secret'));
});

test('upstash kv: refuses to start without a url and token', () => {
  assert.throws(() => upstashKv({ url: '', token: 't', fetch: () => {} }), /url/);
  assert.throws(() => upstashKv({ url: 'u', token: '', fetch: () => {} }), /token/);
});

test('memory kv: counters and sets', async () => {
  const kv = memoryKv();
  assert.strictEqual(await kv.exec(['INCR', 'c']), 1);
  assert.strictEqual(await kv.exec(['INCR', 'c']), 2);
  assert.strictEqual(await kv.exec(['SADD', 's', 'a', 'b', 'a']), 2);
  assert.deepStrictEqual((await kv.exec(['SMEMBERS', 's'])).sort(), ['a', 'b']);
  assert.strictEqual(await kv.exec(['SISMEMBER', 's', 'a']), 1);
  assert.strictEqual(await kv.exec(['SISMEMBER', 's', 'z']), 0);
});

test('memory kv: counters and sets expire', async () => {
  let t = 0;
  const kv = memoryKv({ now: () => t });
  await kv.exec(['INCR', 'c']); await kv.exec(['EXPIRE', 'c', 10]);
  await kv.exec(['SADD', 's', 'a']); await kv.exec(['EXPIRE', 's', 10]);
  t += 11_000;
  assert.strictEqual(await kv.exec(['INCR', 'c']), 1);
  assert.deepStrictEqual(await kv.exec(['SMEMBERS', 's']), []);
});
