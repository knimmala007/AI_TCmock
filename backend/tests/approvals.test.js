// request_approval, the Approve endpoint and the gated hand_off (ticket 043) at the handler seam:
// a scripted fake model, memory storage, no network. The role and the deal come from the signed cookie only.
import test from 'node:test';
import assert from 'node:assert';
import { memoryKv } from '../kv.js';
import { createDailyCap, createRateLimiter } from '../limits.js';
import { createEventLog, memoryEventStore } from '../events.js';
import { createSeenFieldStore, createThreadStore } from '../threads.js';
import { createRepository, memoryStorage } from '../repository.js';
import { cookieName, sessionFromRequest, signSession } from '../session.js';
import { createAgentHandler } from '../agent_handler.js';
import { TOOL_NOT_ALLOWED } from '../agent_loop.js';
import { createApproveHandler } from '../approvals.js';
import { createTools } from '../tools.js';
import { SEED_DEALS } from '../fixtures.js';
import { APPROVE_PER_MINUTE } from '../config.js';

let realFetch;
test.beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('a test tried to reach the network'); };
});
test.afterEach(() => { globalThis.fetch = realFetch; });

const env = {};
const DEAL = 'tx_unknown_city';
const OTHER = 'TX-CG118';
const SELLER_FORMS = ['TDS', 'SPQ'];
const BUYER_FORMS = ['WFA', 'SPT'];
const FINANCED = 'Yes, with a lender loan';
const SENTINEL = 'ZEBRA-BROKER-CHAT-4417';
const usage = { input_tokens: 1, output_tokens: 1 };
const ok = text => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const uses = (...blocks) => ({ content: blocks, stop_reason: 'tool_use', usage });

const cookieFor = (role, dealId = DEAL, sessionId = 's-1') =>
  `${cookieName}=${signSession({ role, sessionId, dealId }, env)}`;
const chat = (cookie, message = 'hi') => new Request('http://x/api/agent', {
  method: 'POST', body: JSON.stringify({ message }), headers: { 'content-type': 'application/json', cookie },
});

// A copy of a seeded deal with extra keys; a session can only name a seeded deal id.
const variant = (extra = {}, answers = {}) => ({
  ...structuredClone(SEED_DEALS[DEAL]), ...extra,
  answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, { v, src: 'test' }])),
});

function world({ deal = variant() } = {}) {
  const kv = memoryKv();
  const repository = createRepository(memoryStorage());
  const store = memoryEventStore();
  const eventLog = createEventLog(store);
  const common = {
    getSession: r => sessionFromRequest(r, env), limiter: createRateLimiter(kv), dailyCap: createDailyCap(kv, { cap: 1000 }),
    eventLog, threads: createThreadStore(kv), repository, seenFields: createSeenFieldStore(kv),
  };
  const ready = repository.save(deal);
  const requests = [];

  // One chat message in which the model makes the given tool calls in order. Returns the parsed results.
  async function turn(role, calls, { dealId = DEAL, sessionId = 's-1', message } = {}) {
    await ready;
    const replies = [uses(...calls.map(([name, input], i) => use(`c${i}`, name, input))), ok('done')];
    let n = 0;
    const handler = createAgentHandler({ ...common, perMinute: 1000, callModel: async req => {
      requests.push(structuredClone(req));
      return replies[Math.min(n++, replies.length - 1)];
    } });
    const before = requests.length;
    const res = await handler(chat(cookieFor(role, dealId, sessionId), message));
    assert.strictEqual(res.status, 200);
    const mine = requests.slice(before);
    const results = mine.at(-1).messages.at(-1).content.map(r => {
      let json = null;
      try { json = JSON.parse(r.content); } catch { /* plain text */ }
      return { is_error: !!r.is_error, text: r.content, json };
    });
    return { results, e: results[0].json, text: results[0].text, requests: mine };
  }

  let tick = 0;
  const approve = createApproveHandler({
    repository, eventLog, limiter: common.limiter, getSession: common.getSession,
    newTurnId: () => `click-${++tick}`, now: () => new Date(Date.UTC(2026, 9, 28, 10, 0, tick)),
  });
  const click = (role, body, { dealId = DEAL, method = 'POST', headers = {}, url = 'http://x/api/approve' } = {}) =>
    approve(new Request(url, {
      method, headers: { 'content-type': 'application/json', cookie: cookieFor(role, dealId), ...headers },
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    }));

  const stored = (id = DEAL) => repository.get(id);
  const request = async (to, forms) => (await turn('broker', [['request_approval', { to, forms }]])).e;
  const handOff = async (to, forms, extra = {}) => (await turn('broker', [['hand_off', { to, forms, ...extra }]])).e;
  // request_approval through the model, then the broker's click. Returns the click's response.
  async function approved(to, forms) {
    const r = await request(to, forms);
    assert.strictEqual(r.ok, true);
    const res = await click('broker', { action: 'hand_off', request_id: r.data.request_id });
    assert.strictEqual(res.status, 200);
    return res;
  }
  return { repository, store, requests, turn, click, stored, request, handOff, approved, ready, approve, common };
}

// ---- 1. hand_off is refused until the broker has approved ----

test('hand_off returns APPROVAL_REQUIRED before any approval, for every recipient, and records nothing', async () => {
  const w = world({ deal: variant({}, { buyerFinancing: FINANCED }) });
  for (const [to, forms] of [['seller', SELLER_FORMS], ['buyer', BUYER_FORMS], ['lender', ['APPR']]]) {
    const e = await w.handOff(to, forms);
    assert.strictEqual(e.ok, false, to);
    assert.strictEqual(e.error.code, 'APPROVAL_REQUIRED', to);
  }
  assert.strictEqual((await w.stored()).handoffs, undefined);
});

test('a pending request is not an approval', async () => {
  const w = world();
  const r = await w.request('seller', SELLER_FORMS);
  assert.deepStrictEqual([r.ok, r.data.status], [true, 'requested']);
  assert.match(r.data.request_id, /^[0-9a-f-]{36}$/);
  const e = await w.handOff('seller', SELLER_FORMS);
  assert.strictEqual(e.error.code, 'APPROVAL_REQUIRED');
  const deal = await w.stored();
  assert.strictEqual(deal.approvals, undefined);
  assert.deepStrictEqual(Object.keys(deal.approval_requests.hand_off).sort(),
    ['forms', 'request_id', 'requested_at', 'requested_by', 'to']);
});

// ---- 2. the Approve endpoint re-checks the broker from the signed session ----

test('each role presses Approve: only the broker is accepted, and a refusal changes nothing', async () => {
  const w = world();
  const { request_id } = (await w.request('seller', SELLER_FORMS)).data;
  const body = { action: 'hand_off', request_id };
  for (const role of ['seller', 'buyer', 'lender']) {
    const res = await w.click(role, body);
    assert.strictEqual(res.status, 403, role);
    assert.strictEqual((await res.json()).error, 'ROLE_FORBIDDEN');
    const deal = await w.stored();
    assert.strictEqual(deal.approvals, undefined, role);
    assert.strictEqual(deal.approval_requests.hand_off.request_id, request_id, role);
  }
  const res = await w.click('broker', body);
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).ok, true);
  assert.ok((await w.stored()).approvals.hand_off.granted_at);
});

test('a role in the body, query or headers does not make a buyer the broker; no session is 401', async () => {
  const w = world();
  const { request_id } = (await w.request('seller', SELLER_FORMS)).data;
  const res = await w.click('buyer', { action: 'hand_off', request_id, role: 'broker', dealId: OTHER, session: { role: 'broker' } },
    { url: 'http://x/api/approve?role=broker', headers: { 'x-role': 'broker' } });
  assert.strictEqual(res.status, 403);
  assert.strictEqual((await w.stored()).approvals, undefined);
  const anon = await w.approve(new Request('http://x/api/approve', { method: 'POST', body: JSON.stringify({ action: 'hand_off', request_id }) }));
  assert.strictEqual(anon.status, 401);
});

test('GET /api/approve lists pending requests for the broker only, and leaks nothing to other roles', async () => {
  const w = world();
  const { request_id } = (await w.request('seller', SELLER_FORMS)).data;
  const res = await w.click('broker', null, { method: 'GET' });
  assert.strictEqual(res.status, 200);
  const { pending } = await res.json();
  assert.strictEqual(pending.length, 1);
  assert.deepStrictEqual([pending[0].action, pending[0].request_id, pending[0].to, pending[0].forms], ['hand_off', request_id, 'seller', SELLER_FORMS]);
  for (const role of ['seller', 'buyer', 'lender']) {
    const r = await w.click(role, null, { method: 'GET' });
    assert.strictEqual(r.status, 403, role);
    assert.ok(!(await r.text()).includes(request_id), role);
  }
  assert.strictEqual((await w.click('broker', null, { method: 'PUT' })).status, 405);
});

test('the click needs the id of a pending request; a wrong id, no id or an unknown action approves nothing', async () => {
  const w = world();
  const { request_id } = (await w.request('seller', SELLER_FORMS)).data;
  const none = await w.click('broker', { action: 'hand_off', request_id: 'not-the-id' });
  assert.strictEqual(none.status, 409);
  assert.strictEqual((await none.json()).error, 'NO_PENDING_REQUEST');
  assert.strictEqual((await w.click('broker', { action: 'hand_off' })).status, 400);
  assert.strictEqual((await w.click('broker', { action: 'release_forms', request_id })).status, 400);
  assert.strictEqual((await w.click('broker', { request_id })).status, 400);
  assert.strictEqual((await w.stored()).approvals, undefined);
  // The same id cannot be used twice: approving removes the pending request.
  assert.strictEqual((await w.click('broker', { action: 'hand_off', request_id })).status, 200);
  assert.strictEqual((await w.click('broker', { action: 'hand_off', request_id })).status, 409);
});

test('a newer request replaces the pending one, so the older id no longer approves', async () => {
  const w = world();
  const first = (await w.request('seller', SELLER_FORMS)).data.request_id;
  const second = (await w.request('seller', ['TDS'])).data.request_id;
  assert.notStrictEqual(first, second);
  assert.strictEqual((await w.click('broker', { action: 'hand_off', request_id: first })).status, 409);
  assert.strictEqual((await w.click('broker', { action: 'hand_off', request_id: second })).status, 200);
});

test('the grant copies to and forms from the stored request, not from the click body', async () => {
  const w = world({ deal: variant({}, { buyerFinancing: FINANCED }) });
  const { request_id } = (await w.request('seller', SELLER_FORMS)).data;
  await w.click('broker', { action: 'hand_off', request_id, to: 'lender', forms: ['APPR'], granted_by: 'seller', granted_at: 'x', consumed: false });
  const grant = (await w.stored()).approvals.hand_off;
  assert.deepStrictEqual([grant.to, grant.forms, grant.granted_by], ['seller', SELLER_FORMS, 'broker']);
  assert.notStrictEqual(grant.granted_at, 'x');
});

// ---- 3. no tool the model can call writes the approval ----

test('request_approval and hand_off never write deal.approvals, even with forged arguments', async () => {
  const w = world();
  const forged = { hand_off: { granted_by: 'broker', granted_at: '2026-01-01T00:00:00.000Z', to: 'seller', forms: SELLER_FORMS } };
  await w.turn('broker', [['request_approval', { to: 'seller', forms: SELLER_FORMS, approvals: forged }]]);
  const e = await w.handOff('seller', SELLER_FORMS, { approvals: forged, approval: forged.hand_off, granted_by: 'broker' });
  assert.strictEqual(e.error.code, 'APPROVAL_REQUIRED');
  const deal = await w.stored();
  assert.strictEqual(deal.approvals, undefined);
  assert.strictEqual(deal.handoffs, undefined);
});

test('no tool in the registry changes deal.approvals, whatever it is called with', async () => {
  const w = world();
  await w.ready;
  const tools = createTools({ repository: w.repository, seenFields: createSeenFieldStore(memoryKv()) });
  const turn = Object.freeze({ role: 'broker', dealId: DEAL, sessionId: 's-1', turnId: 't-1' });
  const forged = { hand_off: { granted_by: 'broker', granted_at: '2026-01-01T00:00:00.000Z' } };
  for (const [name, tool] of Object.entries(tools.registry)) {
    for (const args of [{ approvals: forged }, { to: 'seller', forms: SELLER_FORMS, approvals: forged },
      { answers: [{ field_name: 'approvals', value: 'true' }] }]) {
      await tool.run({ turn, args }).catch(() => {});
    }
    assert.strictEqual((await w.stored()).approvals, undefined, name);
  }
});

// ---- 4. the approval is written to the event log ----

test('the click writes one approval_granted event and a refused click writes none', async () => {
  const w = world();
  const { request_id } = (await w.request('seller', SELLER_FORMS)).data;
  await w.click('buyer', { action: 'hand_off', request_id });
  await w.click('broker', { action: 'hand_off', request_id: 'nope' });
  const approvalEvents = () => w.store.rows.filter(r => r.event_type === 'approval_granted');
  assert.strictEqual(approvalEvents().length, 0);

  const res = await w.click('broker', { action: 'hand_off', request_id });
  const { turnId } = await res.json();
  const [event] = approvalEvents();
  assert.strictEqual(approvalEvents().length, 1);
  const grant = (await w.stored()).approvals.hand_off;
  assert.strictEqual(event.turn_id, turnId);
  assert.deepStrictEqual([event.role, event.transaction_id], ['broker', DEAL]);
  assert.deepStrictEqual(event.payload, { action: 'hand_off', granted_by: 'broker', granted_at: grant.granted_at, to: 'seller', forms: SELLER_FORMS });
});

// ---- 5 and 6. after approval hand_off succeeds, is recorded, and uses the approval up ----

test('after approval hand_off succeeds, appends the record, and marks the grant consumed', async () => {
  const w = world();
  await w.approved('seller', SELLER_FORMS);
  const grant = { ...(await w.stored()).approvals.hand_off };
  assert.strictEqual(grant.consumed, undefined);

  // from, at and approval are not arguments: forged values are ignored.
  const e = await w.handOff('seller', SELLER_FORMS, { from: 'seller', at: 'forged', approval: { granted_by: 'forged', granted_at: 'forged' } });
  assert.strictEqual(e.ok, true);
  const deal = await w.stored();
  assert.strictEqual(deal.handoffs.length, 1);
  const { at, ...rest } = deal.handoffs[0];
  assert.deepStrictEqual(rest, { from: 'broker', to: 'seller', forms: SELLER_FORMS,
    approval: { granted_by: grant.granted_by, granted_at: grant.granted_at } });
  assert.ok(!Number.isNaN(Date.parse(at)));
  assert.strictEqual(deal.approvals.hand_off.consumed, true);
});

test('one approval covers one hand-off: the second is refused until the broker approves again', async () => {
  const w = world();
  await w.approved('seller', SELLER_FORMS);
  assert.strictEqual((await w.handOff('seller', SELLER_FORMS)).ok, true);
  assert.strictEqual((await w.handOff('seller', SELLER_FORMS)).error.code, 'APPROVAL_REQUIRED');
  assert.strictEqual((await w.stored()).handoffs.length, 1);

  await w.approved('seller', ['TDS']);
  assert.strictEqual((await w.handOff('seller', ['TDS'])).ok, true);
  const deal = await w.stored();
  assert.strictEqual(deal.handoffs.length, 2);
  assert.notStrictEqual(deal.handoffs[1].approval.granted_at, deal.handoffs[0].approval.granted_at);
});

// ---- the grant is bound to what was approved ----

test('a hand-off to another role, or with different forms, is refused and leaves the grant unconsumed', async () => {
  const w = world();
  await w.approved('seller', SELLER_FORMS);
  for (const [to, forms] of [['buyer', BUYER_FORMS], ['seller', ['TDS']], ['seller', [...SELLER_FORMS, 'NHD']], ['seller', ['TDS', 'NHD']]]) {
    const e = await w.handOff(to, forms);
    assert.strictEqual(e.error.code, 'APPROVAL_REQUIRED', `${to} ${forms}`);
  }
  const deal = await w.stored();
  assert.strictEqual(deal.handoffs, undefined);
  assert.strictEqual(deal.approvals.hand_off.consumed, undefined);
  // The approved hand-off still works, and the order of the forms does not matter.
  assert.strictEqual((await w.handOff('seller', [...SELLER_FORMS].reverse())).ok, true);
});

// ---- 8. release and hand-off stay separate ----

test('a hand-off to the buyer is refused until the forms are released, and the approval is kept', async () => {
  const w = world();
  await w.approved('buyer', BUYER_FORMS);
  const e = await w.handOff('buyer', BUYER_FORMS);
  assert.strictEqual(e.error.code, 'APPROVAL_REQUIRED');
  let deal = await w.stored();
  assert.strictEqual(deal.handoffs, undefined);
  assert.strictEqual(deal.approvals.hand_off.consumed, undefined);

  // Only part of the forms released: still refused.
  await w.repository.save({ ...deal, released: { buyer: [BUYER_FORMS[0]] } });
  assert.strictEqual((await w.handOff('buyer', BUYER_FORMS)).error.code, 'APPROVAL_REQUIRED');

  deal = await w.stored();
  await w.repository.save({ ...deal, released: { buyer: BUYER_FORMS } });
  assert.strictEqual((await w.handOff('buyer', BUYER_FORMS)).ok, true);
});

test('a hand-off to the lender needs the appraisal released; nothing is released today', async () => {
  const w = world({ deal: variant({}, { buyerFinancing: FINANCED }) });
  await w.approved('lender', ['APPR']);
  assert.strictEqual((await w.handOff('lender', ['APPR'])).error.code, 'APPROVAL_REQUIRED');
  const deal = await w.stored();
  assert.strictEqual(deal.handoffs, undefined);
  await w.repository.save({ ...deal, released: { lender: ['APPR'] } });
  assert.strictEqual((await w.handOff('lender', ['APPR'])).ok, true);
});

test('release never widens access: a form the recipient may not see is refused even if it is released', async () => {
  const w = world({ deal: variant({ released: { buyer: ['TDS', 'WFA'], lender: ['TDS'] } }) });
  for (const [to, forms] of [['buyer', ['TDS']], ['buyer', ['TDS', 'WFA']], ['lender', ['TDS']]]) {
    assert.strictEqual((await w.request(to, forms)).error.code, 'ROLE_FORBIDDEN', `${to} ${forms}`);
    assert.strictEqual((await w.handOff(to, forms)).error.code, 'ROLE_FORBIDDEN', `${to} ${forms}`);
  }
  assert.strictEqual((await w.stored()).approval_requests, undefined);
});

test('a seller as recipient needs no release, but only forms its role may see', async () => {
  // APPR is the buyer-side appraisal: required once the buyer is financing, and not a seller form.
  const w = world({ deal: variant({}, { buyerFinancing: FINANCED }) });
  assert.strictEqual((await w.request('seller', ['APPR'])).error.code, 'ROLE_FORBIDDEN');
  await w.approved('seller', SELLER_FORMS);
  assert.strictEqual((await w.handOff('seller', SELLER_FORMS)).ok, true);
});

// ---- arguments and fixed errors ----

test('bad arguments are refused with fixed text and nothing is recorded', async () => {
  const w = world();
  for (const args of [{}, { to: 'broker', forms: SELLER_FORMS }, { to: 'seller', forms: [] }, { to: 'seller', forms: 'TDS' },
    { to: 'seller', forms: ['TDS', 'TDS'] }, { to: 'seller', forms: [1] }, { to: 'admin', forms: ['TDS'] }]) {
    for (const name of ['request_approval', 'hand_off']) {
      const { results } = await w.turn('broker', [[name, args]]);
      assert.strictEqual(results[0].is_error, true, `${name} ${JSON.stringify(args)}`);
      assert.ok(!results[0].text.includes('admin'));
    }
  }
  const deal = await w.stored();
  assert.deepStrictEqual([deal.approval_requests, deal.approvals, deal.handoffs], [undefined, undefined, undefined]);
});

test('a form that is not part of this deal is FORM_NOT_REQUIRED and the error names no form', async () => {
  const w = world();
  const { text, e } = await w.turn('broker', [['request_approval', { to: 'seller', forms: ['POOL-NOT-A-CODE'] }]]);
  assert.strictEqual(e.error.code, 'FORM_NOT_REQUIRED');
  assert.ok(!text.includes('POOL-NOT-A-CODE'));
});

test('the deal comes from the session: a deal id in the arguments changes nothing in another deal', async () => {
  const w = world();
  await w.repository.save(variant({ transaction_id: OTHER }));
  await w.approved('seller', SELLER_FORMS);
  const e = await w.handOff('seller', SELLER_FORMS, { deal_id: OTHER, dealId: OTHER, transaction_id: OTHER, from: 'seller' });
  assert.strictEqual(e.ok, true);
  assert.strictEqual((await w.stored(OTHER)).handoffs, undefined);
  assert.strictEqual((await w.stored(OTHER)).approvals, undefined);
  assert.strictEqual((await w.stored()).handoffs[0].from, 'broker');
});

// ---- the role seam: only the broker has these tools ----

test('seller, buyer and lender are not offered the tools, and calling them is refused', async () => {
  const w = world();
  for (const role of ['seller', 'buyer', 'lender']) {
    const { results, requests } = await w.turn(role, [['hand_off', { to: 'seller', forms: SELLER_FORMS }], ['request_approval', { to: 'seller', forms: SELLER_FORMS }]]);
    const offered = requests[0].tools.map(t => t.name);
    assert.ok(!offered.includes('hand_off') && !offered.includes('request_approval'), role);
    for (const r of results) { assert.strictEqual(r.is_error, true); assert.strictEqual(r.text, TOOL_NOT_ALLOWED); }
  }
  const broker = (await w.turn('broker', [['get_deal', {}]])).requests[0].tools.map(t => t.name);
  assert.ok(broker.includes('hand_off') && broker.includes('request_approval'));
  const deal = await w.stored();
  assert.deepStrictEqual([deal.approval_requests, deal.handoffs], [undefined, undefined]);
});

test('the tools also refuse a non-broker turn themselves, if the role filter were bypassed', async () => {
  const w = world();
  await w.ready;
  const tools = createTools({ repository: w.repository, seenFields: createSeenFieldStore(memoryKv()) });
  for (const role of ['seller', 'buyer', 'lender']) {
    const turn = Object.freeze({ role, dealId: DEAL, sessionId: 's-1', turnId: 't-1' });
    for (const name of ['request_approval', 'hand_off']) {
      const e = await tools.registry[name].run({ turn, args: { to: 'seller', forms: SELLER_FORMS } });
      assert.strictEqual(e.error.code, 'ROLE_FORBIDDEN', `${role} ${name}`);
    }
  }
  assert.strictEqual((await w.stored()).approval_requests, undefined);
});

// ---- 7. the next role sees released forms and a note, never the earlier chat ----

test('the next role sees who handed off and when, and none of the broker\'s earlier chat', async () => {
  const w = world({ deal: variant({ released: { buyer: BUYER_FORMS } }) });
  await w.approved('buyer', BUYER_FORMS);
  await w.turn('broker', [['hand_off', { to: 'buyer', forms: BUYER_FORMS }]], { message: SENTINEL });
  const record = (await w.stored()).handoffs[0];

  // The same session id on purpose: the thread is keyed by role as well.
  const { e, requests } = await w.turn('buyer', [['get_deal_status', {}]]);
  assert.strictEqual(e.ok, true);
  assert.deepStrictEqual(e.data.handoff, { from: 'broker', at: record.at, forms: BUYER_FORMS });
  assert.ok(!JSON.stringify(requests).includes(SENTINEL));
  assert.ok(!JSON.stringify(e).includes('granted_by'));
  // The broker's own chat still holds it, so the sentinel check is meaningful.
  const broker = await w.turn('broker', [['get_deal', {}]]);
  assert.ok(JSON.stringify(broker.requests).includes(SENTINEL));
});

test('a role nothing was handed to has no note, and the note shows only forms its role may see', async () => {
  const w = world();
  await w.approved('seller', SELLER_FORMS);
  await w.handOff('seller', SELLER_FORMS);
  assert.strictEqual((await w.turn('buyer', [['get_deal_status', {}]])).e.data.handoff, undefined);
  assert.strictEqual((await w.turn('lender', [['get_deal_status', {}]])).e.data.handoff, undefined);
  const seller = (await w.turn('seller', [['get_deal_status', {}]])).e.data.handoff;
  assert.deepStrictEqual([seller.from, seller.forms], ['broker', SELLER_FORMS]);

  // A stored record naming a form the role may not see is filtered before the model sees it.
  const deal = await w.stored();
  deal.handoffs.push({ from: 'broker', to: 'buyer', forms: ['WFA', 'TDS'], at: 'now', approval: { granted_by: 'broker', granted_at: 'then' } });
  await w.repository.save(deal);
  assert.deepStrictEqual((await w.turn('buyer', [['get_deal_status', {}]])).e.data.handoff.forms, ['WFA']);
});

test('the broker\'s get_deal carries no hand-off note', async () => {
  const w = world();
  await w.approved('seller', SELLER_FORMS);
  await w.handOff('seller', SELLER_FORMS);
  assert.strictEqual((await w.turn('broker', [['get_deal', {}]])).e.data.handoff, undefined);
});

// ---- the endpoint's own limit, and the order of log and save ----

test('the Approve endpoint is rate limited by its own APPROVE_PER_MINUTE', async () => {
  const w = world();
  let last;
  for (let i = 0; i <= APPROVE_PER_MINUTE; i++) last = await w.click('broker', null, { method: 'GET', headers: { 'x-forwarded-for': '9.9.9.9' } });
  assert.strictEqual(last.status, 429);
  assert.strictEqual((await last.json()).error, 'RATE_LIMITED');
  // Another client is not limited.
  assert.strictEqual((await w.click('broker', null, { method: 'GET', headers: { 'x-forwarded-for': '8.8.8.8' } })).status, 200);
});

test('if the audit event cannot be written, no grant is saved and the request stays pending', async () => {
  const w = world();
  const { request_id } = (await w.request('seller', SELLER_FORMS)).data;
  const failing = createApproveHandler({
    repository: w.repository, getSession: w.common.getSession,
    eventLog: { logEvent: async () => { throw new Error('log down'); } },
  });
  const req = new Request('http://x/api/approve', { method: 'POST', body: JSON.stringify({ action: 'hand_off', request_id }),
    headers: { 'content-type': 'application/json', cookie: cookieFor('broker') } });
  await assert.rejects(failing(req), /log down/);
  const deal = await w.stored();
  assert.strictEqual(deal.approvals, undefined);
  assert.strictEqual(deal.approval_requests.hand_off.request_id, request_id);
});
