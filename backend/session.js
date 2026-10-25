// The demo session (spec, section 4). There is no sign-in yet: the UI's role switcher calls
// /api/demo-session, which validates the role and sets this signed, HttpOnly cookie. The agent
// reads the acting role ONLY from this cookie, never from a body, chat text, tool argument or
// model output. It is a stand-in for real sign-in (reminders.md R6).
//
// It is NOT DEV_FAKE_AUTH. That switch belongs to the real app and stays impossible on Vercel.
// This one is meant to run on Vercel in demo mode, so it needs an owner-set signing secret there.
import crypto from 'node:crypto';
import { ROLE_TOOLS } from './roles.js';
import { SEED_DEALS } from './fixtures.js';

export const cookieName = 'session';

export class SessionConfigError extends Error {}

function secretFor(env) {
  if (env.AGENT_SESSION_SECRET) return env.AGENT_SESSION_SECRET;
  // A built-in default would let anyone forge a broker cookie on a public endpoint.
  if (env.VERCEL) throw new SessionConfigError('AGENT_SESSION_SECRET must be set on Vercel');
  return 'local-dev-only-secret';
}
const sign = (body, env) => crypto.createHmac('sha256', secretFor(env)).update(body).digest('base64url');

const isRole = role => typeof role === 'string' && Object.hasOwn(ROLE_TOOLS, role);
const isDeal = dealId => typeof dealId === 'string' && Object.hasOwn(SEED_DEALS, dealId);

export function signSession({ role, sessionId = crypto.randomUUID(), dealId }, env = process.env) {
  if (!isRole(role)) throw new Error(`unknown role: ${role}`);
  if (!isDeal(dealId)) throw new Error(`unknown deal: ${dealId}`);
  const body = Buffer.from(JSON.stringify({ role, sessionId, dealId })).toString('base64url');
  return `${body}.${sign(body, env)}`;
}

function readCookie(req, name) {
  const header = req.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

// Returns {role, sessionId, dealId}, or null when there is no valid session.
export function sessionFromRequest(req, env = process.env) {
  const token = readCookie(req, cookieName);
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const expected = Buffer.from(sign(body, env));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
    const { role, sessionId, dealId } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!isRole(role) || !isDeal(dealId) || typeof sessionId !== 'string' || !sessionId) return null;
    return { role, sessionId, dealId };
  } catch {
    return null; // bad token, or no secret configured: no session
  }
}
