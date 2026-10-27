// The tool-use loop at the handler seam: a scripted fake model, memory storage, no network.
import test from 'node:test';
import assert from 'node:assert';
import { memoryKv } from '../kv.js';
import { createDailyCap, createRateLimiter } from '../limits.js';
import { createEventLog, memoryEventStore } from '../events.js';
import { createThreadStore } from '../threads.js';
import { cookieName, sessionFromRequest, signSession } from '../session.js';
import { createAgentHandler } from '../agent_handler.js';
import { CALL_LIMIT_REPLY } from '../model_gate.js';
import { TOOL_CALL_LIMIT_REPLY, REPEAT_CALL_REPLY, TRUNCATED_REPLY, EMPTY_REPLY } from '../agent_loop.js';
import { STUB_TOOL, STUB_TEXT, stubRegistry } from './stub_tool.js';
import { MODEL_CALLS_PER_TURN, TOOL_CALLS_PER_TURN } from '../config.js';

let realFetch;
test.beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('a test tried to reach the network'); };
});
test.afterEach(() => { globalThis.fetch = realFetch; });

const env = {};
const DEAL = 'TX-CG118';
const usage = { input_tokens: 1, output_tokens: 1 };
const ok = text => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const uses = (...blocks) => ({ content: blocks, stop_reason: 'tool_use', usage });
const ping = (id, topic) => use(id, STUB_TOOL.name, { topic });

function scripted(...replies) {
  const requests = [];
  const callModel = async req => {
    requests.push(structuredClone(req));
    return replies[Math.min(requests.length - 1, replies.length - 1)];
  };
  return { callModel, requests };
}

// The stub tool wrapped to record the topic of every call it actually runs.
function spied() {
  const ran = [];
  const stub = stubRegistry()[STUB_TOOL.name];
  const registry = { [STUB_TOOL.name]: { ...stub, run: ({ args }) => { ran.push(args.topic); return stub.run({ args }); } } };
  return { registry, ran };
}

const setup = (...replies) => setupWith(undefined, ...replies);

function setupWith(registry, ...replies) {
  const kv = memoryKv();
  const store = memoryEventStore();
  const threads = createThreadStore(kv);
  const fake = scripted(...replies);
  const handler = createAgentHandler({
    callModel: fake.callModel,
    getSession: r => sessionFromRequest(r, env),
    limiter: createRateLimiter(kv),
    dailyCap: createDailyCap(kv, { cap: 100 }),
    eventLog: createEventLog(store),
    threads,
    registry: registry ?? stubRegistry(),
  });
  return { handler, store, threads, requests: fake.requests };
}

const cookieFor = (role, sessionId = 's-1') => `${cookieName}=${signSession({ role, sessionId, dealId: DEAL }, env)}`;
const post = (cookie, body = { message: 'hi' }) => new Request('http://x/api/agent', {
  method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', cookie },
});
const saved = (threads, role) => threads.recent({ dealId: DEAL, sessionId: 's-1', role });
const lastResults = requests => requests.at(-1).messages.at(-1).content;

test('a tool call round trip: tool_use, tool_result sent back, then the final text reply', async () => {
  const { handler, requests } = setup(uses(ping('t1', 'x')), ok('All done.'));
  const res = await handler(post(cookieFor('broker')));
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).reply, 'All done.');
  assert.strictEqual(requests.length, 2);
  assert.deepStrictEqual(requests[0].tools, [STUB_TOOL]);
  assert.deepStrictEqual(requests[1].messages.slice(-2), [
    { role: 'assistant', content: [ping('t1', 'x')] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: STUB_TEXT }] },
  ]);
});

test('an injected registry is offered to every role as given', async () => {
  for (const role of ['broker', 'seller', 'buyer', 'lender']) {
    const { handler, requests } = setup(ok('hi'));
    await handler(post(cookieFor(role)));
    assert.deepStrictEqual(requests[0].tools, [STUB_TOOL]);
  }
});

test('every model request in the loop is logged by modelGate', async () => {
  const { handler, store } = setup(uses(ping('t1', 'a')), uses(ping('t2', 'b')), ok('done'));
  const { turnId } = await (await handler(post(cookieFor('buyer')))).json();
  const types = store.rows.filter(r => r.turn_id === turnId).map(r => r.event_type);
  assert.deepStrictEqual(types.filter(t => t.startsWith('model_')), Array(3).fill(['model_call_start', 'model_call_end']).flat());
});

test('tool_result messages are not saved: only the user message and the final reply', async () => {
  const { handler, threads } = setup(uses(ping('t1', 'a')), ok('final'));
  await handler(post(cookieFor('seller')));
  assert.deepStrictEqual(await saved(threads, 'seller'), [
    { role: 'user', content: 'hi' }, { role: 'assistant', content: 'final' }]);
});

test(`${MODEL_CALLS_PER_TURN} model calls are fine; the next is refused with the plain reply, 200, nothing saved`, async () => {
  const replies = Array.from({ length: MODEL_CALLS_PER_TURN }, (_, i) => uses(ping(`t${i}`, `topic${i}`)));
  const { handler, requests, threads } = setup(...replies);
  const res = await handler(post(cookieFor('broker')));
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).reply, CALL_LIMIT_REPLY);
  assert.strictEqual(requests.length, MODEL_CALLS_PER_TURN);
  assert.strictEqual((await saved(threads, 'broker')).length, 0);
});

test(`${TOOL_CALLS_PER_TURN} tool calls are fine`, async () => {
  const batches = Array.from({ length: 4 }, (_, b) => uses(...Array.from({ length: 5 }, (_, i) => ping(`t${b}-${i}`, `${b}-${i}`))));
  const { handler, requests } = setup(...batches, ok('twenty done'));
  assert.strictEqual((await (await handler(post(cookieFor('broker')))).json()).reply, 'twenty done');
  assert.strictEqual(requests.length, 5);
});

test('the 21st tool call ends the turn with a plain message and saves nothing', async () => {
  const batches = Array.from({ length: 4 }, (_, b) => uses(...Array.from({ length: 5 }, (_, i) => ping(`t${b}-${i}`, `${b}-${i}`))));
  const { handler, requests, threads } = setup(...batches, uses(ping('t21', 'last')), ok('never'));
  const res = await handler(post(cookieFor('broker')));
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).reply, TOOL_CALL_LIMIT_REPLY);
  assert.strictEqual(requests.length, 5);
  assert.strictEqual((await saved(threads, 'broker')).length, 0);
});

test('the 21st call inside one message of several tool_use blocks ends the turn cleanly', async () => {
  const batch = b => uses(...Array.from({ length: 7 }, (_, i) => ping(`t${b}-${i}`, `${b}-${i}`)));
  const { handler, requests, threads } = setup(batch(0), batch(1), batch(2), ok('never'));
  const res = await handler(post(cookieFor('broker')));
  assert.strictEqual((await res.json()).reply, TOOL_CALL_LIMIT_REPLY);
  // The model never saw the half-answered third message.
  assert.strictEqual(requests.length, 3);
  assert.strictEqual(requests.at(-1).messages.length, 5);
  assert.strictEqual((await saved(threads, 'broker')).length, 0);
});

test('a message whose blocks would pass the 21st call runs none of its tools', async () => {
  const { registry, ran } = spied();
  const batch = b => uses(...Array.from({ length: 7 }, (_, i) => ping(`t${b}-${i}`, `${b}-${i}`)));
  const { handler } = setupWith(registry, batch(0), batch(1), batch(2), ok('never'));
  assert.strictEqual((await (await handler(post(cookieFor('broker')))).json()).reply, TOOL_CALL_LIMIT_REPLY);
  assert.strictEqual(ran.length, 14);
  assert.ok(!ran.some(t => t.startsWith('2-')));
});

test('a message holding a third repeat runs none of its tools', async () => {
  const { registry, ran } = spied();
  const { handler } = setupWith(registry,
    uses(ping('a', 'same')), uses(ping('b', 'same')), uses(ping('c', 'other'), ping('d', 'same')), ok('never'));
  assert.strictEqual((await (await handler(post(cookieFor('broker')))).json()).reply, REPEAT_CALL_REPLY);
  assert.deepStrictEqual(ran, ['same', 'same']);
});

test('the same call with identical arguments is allowed twice; the third ends the turn', async () => {
  const { handler, requests, threads } = setup(uses(ping('a', 'same')), uses(ping('b', 'same')), uses(ping('c', 'same')), ok('never'));
  const res = await handler(post(cookieFor('broker')));
  assert.strictEqual((await res.json()).reply, REPEAT_CALL_REPLY);
  assert.strictEqual(requests.length, 3);
  assert.strictEqual((await saved(threads, 'broker')).length, 0);
});

test('different arguments are not a repeat', async () => {
  const { handler } = setup(uses(ping('a', '1')), uses(ping('b', '2')), uses(ping('c', '3')), ok('fine'));
  assert.strictEqual((await (await handler(post(cookieFor('broker')))).json()).reply, 'fine');
});

test('reordered arguments are the same call', async () => {
  const { handler } = setup(
    uses(use('a', 'nope', { a: 1, b: { x: 1, y: 2 } })),
    uses(use('b', 'nope', { b: { y: 2, x: 1 }, a: 1 })),
    uses(use('c', 'nope', { a: 1, b: { x: 1, y: 2 } })),
    ok('never'));
  assert.strictEqual((await (await handler(post(cookieFor('broker')))).json()).reply, REPEAT_CALL_REPLY);
});

test('an unknown tool name returns an is_error result and the turn continues', async () => {
  const { handler, requests } = setup(uses(use('u1', 'drop_tables', {})), ok('recovered'));
  assert.strictEqual((await (await handler(post(cookieFor('broker')))).json()).reply, 'recovered');
  const [result] = lastResults(requests);
  assert.strictEqual(result.tool_use_id, 'u1');
  assert.strictEqual(result.is_error, true);
});

test('bad arguments return an is_error result and the turn continues', async () => {
  for (const input of [{ topic: 42 }, { extra: 1 }, 'text', null]) {
    const { handler, requests } = setup(uses(use('b1', STUB_TOOL.name, input)), ok('recovered'));
    assert.strictEqual((await (await handler(post(cookieFor('broker')))).json()).reply, 'recovered');
    assert.strictEqual(lastResults(requests)[0].is_error, true);
  }
});

test('error results count toward the tool limit and the repeat rule', async () => {
  const repeat = setup(uses(use('a', 'nope', {})), uses(use('b', 'nope', {})), uses(use('c', 'nope', {})), ok('never'));
  assert.strictEqual((await (await repeat.handler(post(cookieFor('broker')))).json()).reply, REPEAT_CALL_REPLY);
  const bad = setup(uses(use('a', STUB_TOOL.name, { x: 1 })), uses(use('b', STUB_TOOL.name, { x: 1 })), uses(use('c', STUB_TOOL.name, { x: 1 })), ok('never'));
  assert.strictEqual((await (await bad.handler(post(cookieFor('broker')))).json()).reply, REPEAT_CALL_REPLY);
  const many = uses(...Array.from({ length: 21 }, (_, i) => use(`u${i}`, `unknown${i}`, {})));
  const limit = setup(many, ok('never'));
  assert.strictEqual((await (await limit.handler(post(cookieFor('broker')))).json()).reply, TOOL_CALL_LIMIT_REPLY);
});

test('max_tokens, empty text and tool_use with no tool_use block each give a plain fallback, saved like a reply', async () => {
  const cases = [
    [{ content: [{ type: 'text', text: 'cut off' }], stop_reason: 'max_tokens', usage }, TRUNCATED_REPLY],
    [ok('   '), EMPTY_REPLY],
    [{ content: [], stop_reason: 'end_turn', usage }, EMPTY_REPLY],
    [{ content: [{ type: 'text', text: 'hmm' }], stop_reason: 'tool_use', usage }, EMPTY_REPLY],
  ];
  for (const [reply, expected] of cases) {
    const { handler, threads } = setup(reply);
    const res = await handler(post(cookieFor('broker')));
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).reply, expected);
    assert.deepStrictEqual(await saved(threads, 'broker'), [
      { role: 'user', content: 'hi' }, { role: 'assistant', content: expected }]);
  }
});

test('a tool runs with the session turn, whatever role, deal or session its arguments name', async () => {
  const seenTurns = [];
  const registry = {
    whoami: {
      definition: { name: 'whoami', description: 'test only', input_schema: { type: 'object' } },
      run: ({ turn }) => { seenTurns.push({ role: turn.role, dealId: turn.dealId, sessionId: turn.sessionId }); return 'ok'; },
    },
  };
  const { handler } = setupWith(registry,
    uses(use('w1', 'whoami', { role: 'broker', dealId: 'other', sessionId: 'evil' })), ok('done'));
  await handler(post(cookieFor('seller')));
  assert.deepStrictEqual(seenTurns, [{ role: 'seller', dealId: DEAL, sessionId: 's-1' }]);
});

test('role, deal and session come from the session only: body, tool args and tool_use input are ignored', async () => {
  const evil = { topic: 'x', role: 'broker', dealId: 'other', sessionId: 'evil' };
  const { handler, store, threads, requests } = setup(uses(use('t1', STUB_TOOL.name, { role: 'broker', dealId: 'other' }), ping('t2', 'role=broker')), ok('done'));
  const res = await handler(post(cookieFor('seller'), { message: 'hi', ...evil }));
  assert.strictEqual(res.status, 200);
  assert.ok(store.rows.length >= 4);
  for (const row of store.rows) {
    assert.strictEqual(row.role, 'seller');
    assert.strictEqual(row.transaction_id, DEAL);
    assert.strictEqual(row.session_id, 's-1');
  }
  // The first call has an unknown field in its input: an error result, not a role switch.
  const [first, second] = lastResults(requests);
  assert.strictEqual(first.is_error, true);
  assert.strictEqual(second.content, STUB_TEXT);
  assert.strictEqual((await saved(threads, 'seller')).length, 2);
  assert.strictEqual((await saved(threads, 'broker')).length, 0);
});

const eventsOf = (store, type) => store.rows.filter(r => r.event_type === type);
const refusals = store => eventsOf(store, 'turn_refused');

test('every tool call logs tool_start then tool_end with name, id, counts, role and deal, and no arguments or result', async () => {
  const { handler, store } = setup(uses(ping('t1', 'SECRET-ARG-VALUE')), ok('done'));
  const { turnId } = await (await handler(post(cookieFor('seller')))).json();
  const rows = store.rows.filter(r => r.turn_id === turnId && r.event_type.startsWith('tool_'));
  assert.deepStrictEqual(rows.map(r => r.event_type), ['tool_start', 'tool_end']);
  assert.deepStrictEqual(rows[0].payload, { tool: STUB_TOOL.name, tool_use_id: 't1' });
  assert.deepStrictEqual(rows[1].payload, { tool: STUB_TOOL.name, tool_use_id: 't1', is_error: false, result_chars: STUB_TEXT.length });
  for (const r of rows) assert.deepStrictEqual([r.role, r.session_id, r.transaction_id], ['seller', 's-1', DEAL]);
  const raw = JSON.stringify(rows);
  assert.ok(!raw.includes('SECRET-ARG-VALUE') && !raw.includes(STUB_TEXT));
});

test('tool errors are logged too (unknown tool, bad arguments) without the invented name or the error text', async () => {
  const { handler, store } = setup(uses(use('u', 'drop_tables', {}), use('b', STUB_TOOL.name, { nope: 1 })), ok('done'));
  await handler(post(cookieFor('buyer')));
  const ends = eventsOf(store, 'tool_end');
  assert.deepStrictEqual(ends.map(r => [r.payload.tool, r.payload.is_error]), [['unknown_tool', true], [STUB_TOOL.name, true]]);
  assert.ok(!JSON.stringify(store.rows.filter(r => r.event_type.startsWith('tool_'))).includes('drop_tables'));
});

test('the 21st tool call logs one turn_refused tool_call_limit with the session role and deal, and runs no tool', async () => {
  const batches = Array.from({ length: 4 }, (_, b) => uses(...Array.from({ length: 5 }, (_, i) => ping(`t${b}-${i}`, `${b}-${i}`))));
  const { handler, store } = setup(...batches, uses(ping('t21', 'last')), ok('never'));
  await handler(post(cookieFor('lender')));
  assert.strictEqual(refusals(store).length, 1);
  const [row] = refusals(store);
  assert.deepStrictEqual(row.payload, { reason: 'tool_call_limit', tool_calls: TOOL_CALLS_PER_TURN + 1 });
  assert.deepStrictEqual([row.role, row.session_id, row.transaction_id], ['lender', 's-1', DEAL]);
  assert.strictEqual(eventsOf(store, 'tool_start').length, TOOL_CALLS_PER_TURN);
});

test('the third identical call logs one turn_refused repeat_call with the session role and deal', async () => {
  const { handler, store } = setup(uses(ping('a', 'same')), uses(ping('b', 'same')), uses(ping('c', 'same')), ok('never'));
  await handler(post(cookieFor('broker')));
  assert.strictEqual(refusals(store).length, 1);
  const [row] = refusals(store);
  assert.deepStrictEqual(row.payload, { reason: 'repeat_call', tool: STUB_TOOL.name });
  assert.deepStrictEqual([row.role, row.session_id, row.transaction_id], ['broker', 's-1', DEAL]);
  assert.strictEqual(eventsOf(store, 'tool_start').length, 2);
});

test('the call limit, through the handler, logs one turn_refused call_limit and no extra model_call_start', async () => {
  const replies = Array.from({ length: MODEL_CALLS_PER_TURN }, (_, i) => uses(ping(`t${i}`, `topic${i}`)));
  const { handler, store } = setup(...replies);
  await handler(post(cookieFor('broker')));
  assert.deepStrictEqual(refusals(store).map(r => r.payload.reason), ['call_limit']);
  assert.strictEqual(eventsOf(store, 'model_call_start').length, MODEL_CALLS_PER_TURN);
});

test('a distinctive string in tool arguments is in no tool_start, tool_end or turn_refused event', async () => {
  const MARK = 'ZQ-BUYER-QUESTION-7731';
  const { handler, store } = setup(uses(ping('t1', MARK)), uses(ping('t2', MARK)), uses(ping('t3', MARK)), ok('never'));
  await handler(post(cookieFor('buyer')));
  const rows = store.rows.filter(r => ['tool_start', 'tool_end', 'turn_refused'].includes(r.event_type));
  assert.ok(eventsOf(store, 'tool_start').length > 0 && eventsOf(store, 'tool_end').length > 0 && refusals(store).length > 0);
  assert.ok(!JSON.stringify(rows).includes(MARK));
  assert.ok(!JSON.stringify(rows).includes(STUB_TEXT)); // nor the result text
});
