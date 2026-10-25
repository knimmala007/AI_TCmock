// Keeps secrets and personal details out of anything sent to a client, a model or a log.
// Demo mode has no sign-in, so only redacted deal data may be served (reminders.md R15).
const PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]+/g, // API keys
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, // emails
  /\(?\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g, // phone numbers
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN-like numbers (an APN such as 434-24-002 is 3-2-3, so it is kept)
];

export function scrubText(text) {
  return PATTERNS.reduce((s, re) => s.replace(re, '[REDACTED]'), String(text));
}

function scrubDeep(value) {
  if (typeof value === 'string') return scrubText(value);
  if (Array.isArray(value)) return value.map(scrubDeep);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubDeep(v)]));
  return value;
}

// A scrubbed copy of a deal; the original is untouched.
export const redactDeal = deal => scrubDeep(deal);
