// Role registry: role -> allowed tools -> data filter. Applied before the model sees anything.
// The role comes from the server-side session, never from chat text (ADR 0002).
import { DOCS } from './fixtures.js';

export class UnknownRole extends Error {
  constructor(role) { super(`unknown role: ${role}`); this.name = 'UnknownRole'; }
}

export const ROLE_TOOLS = {
  broker: ['get_deal', 'save_answers', 'ask_next_question', 'flag_missing', 'request_approval', 'hand_off'],
  seller: ['get_deal_status', 'explain_form', 'ask_next_question', 'save_answers', 'ask_broker'],
  buyer: ['get_deal_status', 'explain_form', 'acknowledge_disclosure', 'ask_broker'],
  lender: ['get_deal_status', 'explain_form', 'mark_clear_to_close', 'ask_broker'],
};

// Which DOCS `side` values each role may see. Mirrors canAccess() in index.html.
// The broker sees every document, both sides of the deal.
const SIDES = {
  broker: new Set(['seller', 'buyer', 'shared']),
  seller: new Set(['seller', 'shared']),
  buyer: new Set(['buyer', 'shared']),
};

// The lender sees only the loan file. APPR (appraisal) is the only loan-file code in DOCS;
// the loan checklist has no code yet (reminders.md R8).
const LENDER_CODES = new Set(['APPR']);

function checkRole(role) {
  if (!Object.hasOwn(ROLE_TOOLS, role)) throw new UnknownRole(role);
}

export function toolsFor(role) {
  checkRole(role);
  return [...ROLE_TOOLS[role]];
}

// A code with no DOCS entry is a placeholder form the rules engine requires ("not yet
// templated"); the app treats it as seller-side, so does this.
export function canAccessForm(role, code) {
  checkRole(role);
  if (role === 'lender') return LENDER_CODES.has(code);
  const doc = DOCS.find(d => d.code === code);
  return SIDES[role].has(doc ? doc.side : 'seller');
}

export function visibleDocCodes(role) {
  checkRole(role);
  return DOCS.filter(d => canAccessForm(role, d.code)).map(d => d.code);
}
