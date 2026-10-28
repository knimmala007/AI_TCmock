// Status codes and the guards that delegate to them (ADR 0002).
//
// guardWrite decides which code, if any, refuses a write to a form. guardAction decides
// APPROVAL_REQUIRED for gated actions. The other codes (MISSING_FACT, INVALID_VALUE,
// FACT_CONFLICT, LEGAL_JUDGMENT, HUMAN_ATTESTATION_REQUIRED) come from the tools themselves.
import { canAccessForm } from './roles.js';

export const STATUS = Object.fromEntries([
  'MISSING_FACT', 'INVALID_VALUE', 'FACT_CONFLICT', 'ROLE_FORBIDDEN', 'FORM_NOT_REQUIRED',
  'LEGAL_JUDGMENT', 'POST_APPROVAL_CHANGE', 'FORM_LOCKED', 'HUMAN_ATTESTATION_REQUIRED',
  'APPROVAL_REQUIRED',
].map(c => [c, c]));

// Actions that need the broker to press Approve first. APPROVAL_REQUIRED applies to these
// actions, never to a write to a form.
export const APPROVAL_GATED_ACTIONS = new Set([
  'hand_off', 'release_forms', 'freeze_snapshot', 'send_message', 'waive_form', 'override_refusal',
  'reopen_form',
]);

const refuse = (error, message, next_step) => ({ error, message, next_step });

// The tool envelope for a refusal (ADR 0008): {ok: false, error: {code, message, next_step}}.
export const fail = (code, message, next_step) => ({ ok: false, error: { code, message, next_step } });

// Checked in this order, so a role cannot learn anything about a form it may not touch:
// role, then required, then approved snapshot, then lock. Returns null when the write may go ahead.
export function guardWrite({ role, deal, engine, formCode }) {
  if (!canAccessForm(role, formCode)) {
    return refuse(STATUS.ROLE_FORBIDDEN, `The ${role} role may not touch this form.`,
      'Ask the broker via ask_broker if the request is legitimate.');
  }
  if (!engine.requiredForms().includes(formCode)) {
    return refuse(STATUS.FORM_NOT_REQUIRED, `${formCode} is not part of this deal.`,
      'Do not fill it. Use get_deal to see the required forms.');
  }
  const snapshot = deal.approval && deal.approval.snapshot;
  if (snapshot && (snapshot.forms || []).includes(formCode)) {
    return refuse(STATUS.POST_APPROVAL_CHANGE,
      `An approved snapshot exists and this write would change ${formCode}.`,
      'The broker must reopen the form before it can change.');
  }
  const lock = deal.locks && deal.locks[formCode];
  if (lock) {
    return refuse(STATUS.FORM_LOCKED, `${formCode} is locked: ${String(lock.reason).replaceAll('_', ' ')}.`,
      'Wait until the lock is released, then try again.');
  }
  return null;
}

// Per-action grants live in deal.approvals and are set only by the broker's Approve click,
// never by a tool the model can call (reminders.md Q-d). A grant is {granted_by, granted_at, consumed?}
// (ADR 0007): one that is used up (consumed) no longer allows the action.
export function guardAction({ action, deal }) {
  if (!APPROVAL_GATED_ACTIONS.has(action)) return null;
  const grant = deal.approvals && deal.approvals[action];
  if (Boolean(grant && grant.granted_at && !grant.consumed)) return null;
  return refuse(STATUS.APPROVAL_REQUIRED, `${action} needs the broker to press Approve first.`,
    'Ask the broker to approve, then retry.');
}
