// request_approval, the broker's Approve click and the gated hand_off (ticket 043; ADR 0007, 0011).
//
// request_approval only records a pending request on the deal (deal.approval_requests). It never writes a grant.
// Only the Approve endpoint (createApproveHandler below) writes deal.approvals, after re-checking that the signed
// session is the broker. The grant copies `to` and `forms` from the stored request, never from the click, and
// hand_off is refused unless its own `to` and `forms` equal the grant's. A successful hand_off appends the hand-off
// record to deal.handoffs and marks the grant consumed in the same save, so one approval covers one hand-off.
//
// In a tool the role and the deal come only from the frozen turn; in the endpoint only from the signed session.
// A tool's arguments never name a role, a deal, `from`, `at` or `approval`. Every error text is fixed and carries
// no deal data and no echo of what the model sent (reminders R23).
import crypto from 'node:crypto';
import { createEngine } from '../rules.js';
import { ToolArgsError } from './agent_loop.js';
import { APPROVE_PER_MINUTE } from './config.js';
import { clientKey } from './demo_session.js';
import { DOCS } from './fixtures.js';
import { canAccessForm } from './roles.js';
import { STATUS, fail, guardAction } from './status.js';

const ACTION = 'hand_off';
// The actions the Approve endpoint accepts. 046 to 049 add theirs here.
const APPROVABLE_ACTIONS = [ACTION];
// Who a hand-off may go to: not the broker, who is the sender.
const HANDOFF_TARGETS = ['seller', 'buyer', 'lender'];
// Roles whose forms must be released before a hand-off (ADR 0011). Whether a seller needs releases is not decided.
const RELEASE_REQUIRED = new Set(['buyer', 'lender']);

const BAD_ARGS = 'Pass {"to": "seller", "buyer" or "lender", "forms": [form codes]} with at least one form code.';
const NOT_BROKER = fail(STATUS.ROLE_FORBIDDEN, 'Only the broker can do this.', 'Ask the broker.');
const NOT_REQUIRED = fail(STATUS.FORM_NOT_REQUIRED, 'One of those forms is not part of this deal.',
  'Use get_deal to see the required forms and try again.');
const CANNOT_RECEIVE = fail(STATUS.ROLE_FORBIDDEN, 'That role may not receive one of those forms.',
  'Choose forms that role may see, or choose another role.');
const NOT_APPROVED = fail(STATUS.APPROVAL_REQUIRED, 'This hand-off is not what the broker approved.',
  'Use request_approval for exactly this hand-off and ask the broker to press Approve, then retry.');
const NOT_RELEASED = fail(STATUS.APPROVAL_REQUIRED, 'Those forms have not been released to that role.',
  'The broker must release the forms to that role first. Pressing Approve is not enough.');

const engineFor = deal => createEngine({ getAnswers: () => deal.answers || {}, getDeal: () => deal, getDocs: () => DOCS });

// Where a deal records which forms are released to a role (ADR 0011). Nothing writes this until ticket 047, which
// decides the shape; this is the one function that reads it, so the shape stays in one place. The assumed shape
// is one list per role.
export function releasedForms(deal, role) {
  const list = deal.released && Object.hasOwn(deal.released, role) ? deal.released[role] : null;
  return Array.isArray(list) ? list : [];
}

// What the next role is shown about the latest hand-off to it: who handed off, when, and which of those forms its
// role may see. Never the chat. Null when nothing was handed to the role.
export function latestHandoffNote(deal, role) {
  const list = Array.isArray(deal.handoffs) ? deal.handoffs : [];
  const last = list.findLast(h => h && h.to === role);
  if (!last) return null;
  return { from: last.from, at: last.at, forms: last.forms.filter(code => canAccessForm(role, code)) };
}

// `to` and `forms` from the model, or a ToolArgsError. Only these two keys are read; anything else is ignored.
function readHandoff(args) {
  const to = args && args.to;
  const forms = args && args.forms;
  if (!HANDOFF_TARGETS.includes(to) || !Array.isArray(forms) || !forms.length
    || forms.some(f => typeof f !== 'string' || !f) || new Set(forms).size !== forms.length) {
    throw new ToolArgsError(BAD_ARGS);
  }
  return { to, forms: [...forms] };
}

// Each form must be part of this deal and visible to the recipient. A release never widens a role's access.
function checkForms(deal, to, forms) {
  const required = engineFor(deal).requiredForms();
  if (!forms.every(code => required.includes(code))) return NOT_REQUIRED;
  if (!forms.every(code => canAccessForm(to, code))) return CANNOT_RECEIVE;
  return null;
}

const sameForms = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every(code => b.includes(code));

const handoffInput = {
  type: 'object',
  properties: {
    to: { type: 'string', enum: HANDOFF_TARGETS },
    forms: { type: 'array', minItems: 1, items: { type: 'string' } },
  },
  required: ['to', 'forms'], additionalProperties: false,
};

const REQUEST_APPROVAL = {
  name: 'request_approval',
  description: 'Asks the broker to approve handing forms to another role. Pass the role and the exact form codes. ' +
    'This only records a request: it does not approve anything. The broker approves with the Approve button, and ' +
    'only then can hand_off be used for that exact role and those exact forms.',
  input_schema: handoffInput,
};

const HAND_OFF = {
  name: 'hand_off',
  description: 'Hands forms to another role. It is refused until the broker has pressed Approve for exactly this ' +
    'role and these forms, and for a buyer or lender the forms must also have been released to that role.',
  input_schema: handoffInput,
};

// The two tools the broker's assistant gets. `noDeal` is tools.js's fixed "no deal file" envelope.
export function approvalTools({ repository, noDeal, newRequestId = () => crypto.randomUUID(), now = () => new Date() }) {
  async function requestApproval({ turn, args }) {
    if (turn.role !== 'broker') return NOT_BROKER;
    const { to, forms } = readHandoff(args);
    const deal = await repository.get(turn.dealId);
    if (!deal) return noDeal;
    const refusal = checkForms(deal, to, forms);
    if (refusal) return refusal;
    const request_id = newRequestId();
    // The request lives beside the grants, not in them: no tool the model can call writes deal.approvals.
    deal.approval_requests ||= {};
    deal.approval_requests[ACTION] = { request_id, requested_by: turn.role, requested_at: now().toISOString(), to, forms };
    await repository.save(deal);
    return { ok: true, data: { status: 'requested', request_id }, field_names: [] };
  }

  async function handOff({ turn, args }) {
    if (turn.role !== 'broker') return NOT_BROKER;
    const { to, forms } = readHandoff(args);
    const deal = await repository.get(turn.dealId);
    if (!deal) return noDeal;
    const refusal = checkForms(deal, to, forms);
    if (refusal) return refusal;
    // Approval comes before release, so a hand-off nobody approved is APPROVAL_REQUIRED whoever it goes to.
    const gated = guardAction({ action: ACTION, deal });
    if (gated) return fail(gated.error, gated.message, gated.next_step);
    const grant = deal.approvals && deal.approvals[ACTION];
    if (!grant || grant.to !== to || !sameForms(grant.forms, forms)) return NOT_APPROVED;
    if (RELEASE_REQUIRED.has(to)) {
      const released = releasedForms(deal, to);
      if (!forms.every(code => released.includes(code))) return NOT_RELEASED;
    }
    // One save records the hand-off and uses up the grant, so a refusal above never consumes it.
    const at = now().toISOString();
    deal.handoffs = [...(Array.isArray(deal.handoffs) ? deal.handoffs : []),
      { from: turn.role, to, forms, at, approval: { granted_by: grant.granted_by, granted_at: grant.granted_at } }];
    grant.consumed = true;
    await repository.save(deal);
    return { ok: true, data: { handed_off: { to, forms, at } }, field_names: [] };
  }

  return {
    request_approval: { definition: REQUEST_APPROVAL, run: requestApproval },
    hand_off: { definition: HAND_OFF, run: handOff },
  };
}

const json = (status, body, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
});

// GET /api/approve: the pending requests. POST /api/approve {action, request_id}: the broker's Approve click.
// Both are broker only. The role and the deal come only from the signed session; the body contributes the action
// and a request id, which is compared with what is stored and is never authority. The grant's `to` and `forms` are
// copied from the stored request.
export function createApproveHandler({
  repository, eventLog, getSession, limiter, perMinute = APPROVE_PER_MINUTE,
  newTurnId = () => crypto.randomUUID(), now = () => new Date(),
}) {
  return async function handle(req) {
    if (req.method !== 'GET' && req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' }, { allow: 'GET, POST' });
    if (limiter) {
      const r = await limiter.hit(`approve:${clientKey(req)}`, { limit: perMinute, windowSeconds: 60 });
      if (!r.allowed) return json(429, { error: 'RATE_LIMITED', message: 'Too many requests. Please wait a minute.' }, { 'retry-after': '60' });
    }
    const session = getSession(req);
    if (!session) return json(401, { error: 'UNAUTHENTICATED', message: 'Pick a role first.' });
    if (session.role !== 'broker') return json(403, { error: 'ROLE_FORBIDDEN', message: 'Only the broker can approve.' });

    if (req.method === 'GET') {
      const deal = await repository.get(session.dealId);
      const pending = Object.entries((deal && deal.approval_requests) || {})
        .map(([action, r]) => ({ action, request_id: r.request_id, requested_at: r.requested_at, to: r.to, forms: r.forms }));
      return json(200, { pending });
    }

    let body;
    try { body = await req.json(); } catch { body = null; }
    const action = body && body.action;
    const requestId = body && body.request_id;
    if (!APPROVABLE_ACTIONS.includes(action) || typeof requestId !== 'string' || !requestId) {
      return json(400, { error: 'BAD_REQUEST', message: 'Send the action and the request id to approve.' });
    }
    const deal = await repository.get(session.dealId);
    const pending = deal && deal.approval_requests && deal.approval_requests[action];
    if (!pending || pending.request_id !== requestId) {
      return json(409, { error: 'NO_PENDING_REQUEST', message: 'There is no pending request to approve.' });
    }
    const grant = { granted_by: session.role, granted_at: now().toISOString(), to: pending.to, forms: [...pending.forms] };
    // Logged before the grant is saved: if logging fails there is no grant to be unaudited, and if the save then
    // fails the log holds an approval that took no effect (the broker clicks again).
    const turnId = newTurnId();
    await eventLog.logEvent(session.sessionId, turnId, session.role, session.dealId, 'approval_granted',
      { action, granted_by: grant.granted_by, granted_at: grant.granted_at, to: grant.to, forms: grant.forms });
    deal.approvals ||= {};
    deal.approvals[action] = grant;
    delete deal.approval_requests[action];
    await repository.save(deal);
    return json(200, { ok: true, action, turnId });
  };
}
