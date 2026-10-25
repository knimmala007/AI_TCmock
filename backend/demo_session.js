// The role switcher's endpoint (demo mode, no sign-in; a stand-in, reminders.md R6).
// POST {role, deal?}: validates the role, starts a fresh session and sets the cookie. Every switch
// gets a new session id, so switching roles starts a clean thread. The response carries no token.
import { cookieName, SessionConfigError, signSession } from './session.js';
import { ROLE_TOOLS } from './roles.js';
import { SEED_DEALS } from './fixtures.js';
import { DEMO_SESSION_PER_MINUTE, SESSION_MAX_AGE_SECONDS } from './config.js';

const json = (status, body, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
});

export const clientKey = req => (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();

export function createDemoSessionHandler(env = process.env, { limiter, perMinute = DEMO_SESSION_PER_MINUTE } = {}) {
  return async function handler(req) {
    if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' }, { allow: 'POST' });
    if (limiter) {
      const r = await limiter.hit(`demo-session:${clientKey(req)}`, { limit: perMinute, windowSeconds: 60 });
      if (!r.allowed) return json(429, { error: 'RATE_LIMITED' }, { 'retry-after': '60' });
    }
    let body;
    try { body = await req.json(); } catch { return json(400, { error: 'BAD_REQUEST' }); }
    const role = body && body.role;
    const dealId = (body && body.deal) || 'TX-CG118';
    if (typeof role !== 'string' || !Object.hasOwn(ROLE_TOOLS, role)) {
      return json(400, { error: 'BAD_ROLE', message: 'role must be broker, seller, buyer or lender' });
    }
    if (typeof dealId !== 'string' || !Object.hasOwn(SEED_DEALS, dealId)) return json(400, { error: 'BAD_DEAL' });
    let token;
    try { token = signSession({ role, dealId }, env); }
    catch (e) {
      if (e instanceof SessionConfigError) return json(503, { error: 'DEMO_NOT_CONFIGURED' });
      throw e;
    }
    const cookie = `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}`
      + (env.VERCEL ? '; Secure' : '');
    return json(200, { role }, { 'set-cookie': cookie });
  };
}
