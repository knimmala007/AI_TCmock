// Health check: is the deployment alive, and did the shared rules and fixtures get bundled?
// Needs no session, storage or secret, and imports nothing that does. It reports the Node
// version and counts only, never an environment variable's value.
import { DOCS, QUESTIONS } from './fixtures.js';
import { BASE_FORMS } from '../rules.js';

const json = (body, status, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

export function createHealthHandler(env = process.env) {
  return req => {
    if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, { allow: 'GET' });
    return json({
      ok: true,
      node: process.version,
      hosted: Boolean(env.VERCEL),
      questions: QUESTIONS.length,
      documents: DOCS.length,
      baseForms: BASE_FORMS.length,
    }, 200);
  };
}
