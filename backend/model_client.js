// The real model client: the Anthropic Messages API over fetch (no SDK). It implements the one
// interface in model_interface.js, callModel({ system, tools, messages }), and only modelGate calls it.
//
// The key and the model name are inputs, never constants here. Every failure is thrown as a
// ModelCallError with a fixed message, so no upstream text, URL, header or key can reach an event,
// a log or a response.
import { MODEL } from './config.js';
import { validateModelResult } from './model_interface.js';

export const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

// Auth scheme in one place. To switch to Bearer, change authHeaders (and API_VERSION if the docs say so).
export const API_KEY_HEADER = 'x-api-key';
export const API_VERSION_HEADER = 'anthropic-version';
export const API_VERSION = '2023-06-01';
const authHeaders = apiKey => ({ [API_KEY_HEADER]: apiKey, [API_VERSION_HEADER]: API_VERSION });
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 25000;

export const MODEL_FAILED_REPLY = 'The assistant could not answer just now. Please try again in a moment.';

// The one error type this client throws. The message is fixed text plus, for an HTTP error, the
// status code; `status` is that code or null.
export class ModelCallError extends Error {
  constructor(message, status = null) { super(message); this.name = 'ModelCallError'; this.status = status; }
}

export function createModelClient({
  apiKey, model = MODEL, fetchImpl = (...a) => globalThis.fetch(...a),
  maxTokens = MAX_TOKENS, timeoutMs = TIMEOUT_MS,
}) {
  if (typeof apiKey !== 'string' || !apiKey) throw new Error('createModelClient needs an apiKey');
  return async function callModel({ system, tools, messages }) {
    const body = { model, max_tokens: maxTokens, system, messages };
    if (tools && tools.length) body.tools = tools;
    let res;
    try {
      res = await fetchImpl(MESSAGES_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders(apiKey) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new ModelCallError('model request failed or timed out');
    }
    if (!res || !res.ok) {
      const status = res && Number.isInteger(res.status) ? res.status : null;
      throw new ModelCallError(`model request failed with status ${status ?? 'unknown'}`, status);
    }
    let data;
    try { data = await res.json(); } catch { throw new ModelCallError('model reply was not valid JSON'); }
    const result = data && { content: data.content, stop_reason: data.stop_reason, usage: data.usage };
    try { return validateModelResult(result); } catch { throw new ModelCallError('model reply had an unexpected shape'); }
  };
}

// The client for this environment, or undefined when no key is set (the endpoint then answers 503).
export function modelClientFromEnv(env) {
  const apiKey = env.ANTHROPIC_API_KEY;
  return apiKey ? createModelClient({ apiKey }) : undefined;
}
