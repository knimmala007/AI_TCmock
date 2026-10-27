// The broker's inbox (ticket 050, ADR 0008): questions that seller, buyer and lender hand to the broker.
//
// It is its own store, not part of the deal file. A question is not a form field, so nothing here goes
// through guardWrite or the form locks. The asking role and the deal id come only from the frozen turn.
//
// The question text is never delivered to a model other than the asker's own turn: ask_broker returns
// {ticket_id, status: "queued"} only, and the broker's get_deal shows ticket ids, never the text. The broker
// reads the text through GET /api/inbox (createInboxHandler below), which makes no model call.
import crypto from 'node:crypto';
import { ToolArgsError } from './agent_loop.js';
import { AUDIT_PAGE_PER_MINUTE, INBOX_ITEMS_PER_DEAL_MAX, INBOX_QUESTION_MAX_CHARS } from './config.js';
import { clientKey } from './demo_session.js';

// ADR 0008 has no code for these two refusals (none of the ten status codes fits), so they are PROVISIONAL
// transport-style codes, as NOT_FOUND is in tools.js. The text is fixed and never echoes the question.
export const QUESTION_TOO_LONG = { ok: false, error: { code: 'QUESTION_TOO_LONG',
  message: 'That question is too long to hand to the broker.', next_step: 'Shorten the question and try again.' } };
export const INBOX_FULL = { ok: false, error: { code: 'INBOX_FULL',
  message: 'The broker\'s inbox is full for this deal.', next_step: 'Tell the user the broker has to clear it first.' } };

const keyFor = dealId => `inbox:${encodeURIComponent(dealId)}`;

export function createInboxStore(kv, { newTicketId = () => crypto.randomUUID(), now = () => new Date() } = {}) {
  return {
    async add({ dealId, role, question }) {
      const item = { ticket_id: newTicketId(), role, deal_id: dealId, question, created_at: now().toISOString() };
      await kv.exec(['RPUSH', keyFor(dealId), JSON.stringify(item)]);
      return item;
    },
    async list(dealId) {
      return ((await kv.exec(['LRANGE', keyFor(dealId), 0, -1])) || []).map(r => JSON.parse(r));
    },
  };
}

// What the broker's model may see of the inbox: who asked and when, never the text.
export async function inboxSummary(inbox, dealId) {
  const items = await inbox.list(dealId);
  return { count: items.length, items: items.map(({ ticket_id, role, created_at }) => ({ ticket_id, role, created_at })) };
}

const ASK_BROKER = {
  name: 'ask_broker',
  description: 'Hands a question to the broker, who answers it outside this chat. Use it for anything that needs a ' +
    'person, including legal or out-of-scope questions. You get a ticket id back, never an answer.',
  input_schema: {
    type: 'object',
    properties: { question: { type: 'string', description: 'The question for the broker, in the user\'s words.' } },
    required: ['question'],
    additionalProperties: false,
  },
};

// The role and the deal are read from the frozen turn. The only argument read is the question text.
export function askBrokerTool({ inbox }) {
  return {
    definition: ASK_BROKER,
    run: async ({ turn, args }) => {
      const question = args && typeof args.question === 'string' ? args.question.trim() : '';
      if (!question) throw new ToolArgsError('ask_broker needs a non-empty "question".');
      if (question.length > INBOX_QUESTION_MAX_CHARS) return QUESTION_TOO_LONG;
      if ((await inbox.list(turn.dealId)).length >= INBOX_ITEMS_PER_DEAL_MAX) return INBOX_FULL;
      const { ticket_id } = await inbox.add({ dealId: turn.dealId, role: turn.role, question });
      return { ok: true, data: { ticket_id, status: 'queued' }, field_names: [] };
    },
  };
}

const json = (status, body, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
});

// GET /api/inbox: the broker-only read. The role and the deal come only from the signed session; the query
// and body are never read. Fixed text, no deal data in any error.
export function createInboxHandler({ inbox, getSession, limiter, perMinute = AUDIT_PAGE_PER_MINUTE }) {
  return async function GET(req) {
    if (req.method !== 'GET') return json(405, { error: 'METHOD_NOT_ALLOWED' }, { allow: 'GET' });
    if (limiter) {
      const r = await limiter.hit(`inbox:${clientKey(req)}`, { limit: perMinute, windowSeconds: 60 });
      if (!r.allowed) return json(429, { error: 'RATE_LIMITED', message: 'Too many requests. Please wait a minute.' }, { 'retry-after': '60' });
    }
    const session = getSession(req);
    if (!session) return json(401, { error: 'UNAUTHENTICATED', message: 'Pick a role first.' });
    if (session.role !== 'broker') return json(403, { error: 'ROLE_FORBIDDEN', message: 'Only the broker can read the inbox.' });
    return json(200, { items: await inbox.list(session.dealId) });
  };
}
