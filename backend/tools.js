// The tools the model can call (ADR 0008). Every tool returns the one envelope
// {ok, data?, error?: {code, message, next_step}, field_names?}.
//
// The deal and the role come only from the frozen turn (made from the session); a tool's arguments
// are never read for either. Everything the model sees is filtered by role (roles.js) and then
// passed through redactDeal (safety.js). Error text is fixed and carries no deal data (reminders R23).
import { createEngine } from '../rules.js';
import { DOCS } from './fixtures.js';
import { canAccessForm, stageFor, toolsFor } from './roles.js';
import { redactDeal } from './safety.js';

const fail = (code, message, next_step) => ({ ok: false, error: { code, message, next_step } });

// ADR 0008 defines no "not found" code (ten status codes plus UNKNOWN_TOOL, BAD_ARGS, UNKNOWN_FIELD, TURN_LIMIT).
// NOT_FOUND is a PROVISIONAL code until the owner decides; the text is fixed and carries no data.
export const NO_DEAL = fail('NOT_FOUND', 'No deal file is available for this session.',
  'Tell the user the deal could not be loaded and stop.');

// No input: the deal and the role are not arguments, so nothing the model passes is read.
const NO_INPUT = { type: 'object', properties: {}, additionalProperties: false };

const DEFINITIONS = {
  get_deal: {
    name: 'get_deal',
    description: 'Reads the deal for this conversation: address, stage, jurisdiction, field values, missing fields and ' +
      'form statuses, limited to what your role may see. Takes no arguments.',
    input_schema: NO_INPUT,
  },
  get_deal_status: {
    name: 'get_deal_status',
    description: 'Reads the deal for this conversation: address, stage, jurisdiction, field values, missing fields and ' +
      'form statuses, limited to what your role may see. Takes no arguments.',
    input_schema: NO_INPUT,
  },
};

// What the role may see of the deal, as plain data. Nothing outside the role's view is built, so nothing
// outside it can be returned or redacted-by-accident.
function viewOf(role, deal) {
  const engine = createEngine({ getAnswers: () => deal.answers || {}, getDeal: () => deal, getDocs: () => DOCS });
  const required = engine.requiredForms();
  // The lender's forms come from the engine's required forms, so APPR shows only when the buyer is financing.
  const docs = engine.activeDocs().filter(d => canAccessForm(role, d.code) && (role !== 'lender' || required.includes(d.code)));
  const stage = stageFor(role, deal, { financed: required.includes('APPR') });

  const data = deal.data || {};
  const names = [...new Set(docs.flatMap(d => d.fields || []))];
  const fields = Object.fromEntries(names.filter(n => data[n]).map(n => [n, { v: data[n].v, src: data[n].src }]));
  const missing = names.filter(n => !data[n]);

  return {
    view: {
      transaction_id: deal.transaction_id,
      address: deal.address,
      jurisdiction: { city: deal.city, county: deal.county },
      ...(stage ? { stage } : {}),
      fields,
      missing_fields: missing,
      forms: docs.map(d => ({
        code: d.code,
        name: d.name,
        ready: engine.formReady(d.code),
        // A required form with no template is flagged, never filled (ticket 018).
        has_template: DOCS.some(x => x.code === d.code),
      })),
    },
    fieldNames: [...Object.keys(fields), ...missing],
  };
}

export function createTools({ repository, seenFields }) {
  async function getDeal({ turn }) {
    const deal = await repository.get(turn.dealId);
    if (!deal) return NO_DEAL;
    const { view, fieldNames } = viewOf(turn.role, deal);
    await seenFields.add({ dealId: turn.dealId, sessionId: turn.sessionId, role: turn.role }, fieldNames);
    return { ok: true, data: redactDeal(view), field_names: fieldNames };
  }

  const getDealTool = name => ({
    definition: DEFINITIONS[name],
    // Arguments are ignored whatever they are, so they must not change the repeated-call key either.
    key: () => ({}),
    run: getDeal,
  });
  const implemented = { get_deal: getDealTool('get_deal'), get_deal_status: getDealTool('get_deal_status') };

  return {
    registry: implemented,
    // The tools offered to a role: its entry in ROLE_TOOLS, limited to those that are built.
    forRole(role) {
      return toolsFor(role).filter(n => Object.hasOwn(implemented, n));
    },
  };
}
