// The audit page: lists a turn's events (eventsForTurn). Broker only (spec, sections 4 and 10).
// The endpoint re-checks the signed session's role on every request; hiding the button in the UI
// is a convenience, not the control.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const headers = type => ({ 'content-type': type, 'cache-control': 'no-store' });
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: headers('application/json') });

const page = body => new Response(
  `<!doctype html><meta charset="utf-8"><title>Audit log</title>
<style>body{font:14px system-ui;margin:24px;max-width:960px}table{border-collapse:collapse;width:100%}
td,th{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}pre{margin:0;white-space:pre-wrap}</style>
<h1>Audit log</h1>${body}`,
  { status: 200, headers: headers('text/html; charset=utf-8') });

import { AUDIT_PAGE_PER_MINUTE } from './config.js';
import { clientKey } from './demo_session.js';

export function createEventsPageHandler({ eventLog, getSession, limiter, perMinute = AUDIT_PAGE_PER_MINUTE }) {
  return async function GET(req) {
    if (limiter) {
      const r = await limiter.hit(`events:${clientKey(req)}`, { limit: perMinute, windowSeconds: 60 });
      if (!r.allowed) return json(429, { error: 'RATE_LIMITED' });
    }
    const session = getSession(req);
    if (!session) return json(401, { error: 'UNAUTHENTICATED', message: 'Sign in first.' });
    if (session.role !== 'broker') {
      return json(403, { error: 'ROLE_FORBIDDEN', message: 'The audit log is for the broker only.' });
    }
    const turn = new URL(req.url).searchParams.get('turn');
    if (!turn) {
      return page(`<form method="get"><label>Turn id <input name="turn" required></label> <button>Show events</button></form>`);
    }
    const events = (await eventLog.eventsForTurn(turn))
      .filter(e => !session.dealId || e.transaction_id === session.dealId);
    const rows = events.map(e => `<tr><td>${esc(e.ts)}</td><td>${esc(e.role)}</td><td>${esc(e.event_type)}</td>` +
      `<td><pre>${esc(JSON.stringify(e.payload, null, 2))}</pre></td></tr>`).join('');
    return page(`<p>Turn <b>${esc(turn)}</b>: ${events.length} event(s)</p>` +
      `<table><tr><th>Time</th><th>Role</th><th>Event</th><th>Payload</th></tr>${rows}</table>`);
  };
}
