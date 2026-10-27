// The tools the model can call (ADR 0008). Every tool returns the one envelope
// {ok, data?, error?: {code, message, next_step}, field_names?}.
//
// The deal and the role come only from the frozen turn (made from the session); a tool's arguments
// are never read for either. Everything the model sees is filtered by role (roles.js) and then
// passed through redactDeal (safety.js). Error text is fixed and carries no deal data (reminders R23).
import { createEngine } from '../rules.js';
import { ToolArgsError } from './agent_loop.js';
import { DOCS } from './fixtures.js';
import { canAccessForm, stageFor, toolsFor } from './roles.js';
import { redactDeal } from './safety.js';
import { askBrokerTool, inboxSummary } from './inbox.js';
import { STATUS, guardWrite } from './status.js';

const fail = (code, message, next_step) => ({ ok: false, error: { code, message, next_step } });

// ADR 0008 defines no "not found" code (ten status codes plus UNKNOWN_TOOL, BAD_ARGS, UNKNOWN_FIELD, TURN_LIMIT).
// NOT_FOUND is a PROVISIONAL code until the owner decides; the text is fixed and carries no data.
export const NO_DEAL = fail('NOT_FOUND', 'No deal file is available for this session.',
  'Tell the user the deal could not be loaded and stop.');

// Seller certifications (ADR 0010): only the seller session is asked them. Every other role skips them and
// never counts them as candidates. Ticket 039 enforces the save side; the list is a constant here, not a rules.js flag.
export const ATTESTATION_FIELDS = Object.freeze(['waterHeater', 'smokeAlarm', 'coDetector']);
export const NO_QUESTIONS_LEFT = 'No unanswered questions are left for this deal.';

// No input: the deal and the role are not arguments, so nothing the model passes is read.
const NO_INPUT = { type: 'object', properties: {}, additionalProperties: false };

// One fact per call for now. Ticket 036 replaces this with the batch cap in config.js.
const FACTS_PER_CALL = 1;

// Where a chat answer came from (ADR 0010). It must not start with "Derived": the rules overwrite those.
const SOURCE_BY_ROLE = Object.freeze({ seller: 'Seller chat answer', broker: 'Broker chat answer' });

const BAD_SAVE_ARGS = 'save_answers takes {"answers": [{"field_name": text, "value": text}]} with exactly one answer.';
const UNKNOWN_SAVE_FIELD = 'That field name is not a question on this deal. Use ask_next_question to get the next one.';
const EMPTY_SAVE_VALUE = 'That answer was empty, so nothing was saved.';

const DEFINITIONS = {
  save_answers: {
    name: 'save_answers',
    description: 'Saves one answer the user has just given to a question from ask_next_question. Pass the field name ' +
      'exactly as that question gave it and the answer in the user\'s words. Returns the forms this added, removed ' +
      'and filled, and what is still missing. Never guess an answer the user has not given.',
    input_schema: {
      type: 'object',
      properties: {
        answers: {
          type: 'array', minItems: FACTS_PER_CALL, maxItems: FACTS_PER_CALL,
          items: {
            type: 'object',
            properties: { field_name: { type: 'string' }, value: { type: 'string' } },
            required: ['field_name', 'value'], additionalProperties: false,
          },
        },
      },
      required: ['answers'], additionalProperties: false,
    },
  },
  ask_next_question: {
    name: 'ask_next_question',
    description: 'Returns the next unanswered question for this deal, chosen by the system. Ask the user exactly that ' +
      'question in your own words; you cannot pick a different one. Takes no arguments.',
    input_schema: NO_INPUT,
  },
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
  const engine = engineFor(deal);
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

function engineFor(deal) {
  return createEngine({ getAnswers: () => deal.answers || {}, getDeal: () => deal, getDocs: () => DOCS });
}

// Whether the role may save this fact. A fact feeds several forms (q.fills), so the checks run over those forms,
// in the order role, required, approved snapshot, lock. Role comes first and says nothing about any form, so a role
// learns nothing about forms it may not touch. Ticket 037 owns the per-code tests and any change to this order.
// Returns an error envelope, or null when the write may go ahead.
function checkWrite(role, deal, engine, q) {
  const forms = (q.fills || []).filter(code => canAccessForm(role, code));
  if (!forms.length) {
    return fail(STATUS.ROLE_FORBIDDEN, `The ${role} role may not save this answer.`,
      'Ask the broker via ask_broker if the request is legitimate.');
  }
  // The question must apply to this deal. Not "fills a required form": some questions (buyerFinancing, escrow)
  // feed forms that are not required until later, and would be refused before their first answer.
  if (!engine.askable(q)) {
    return fail(STATUS.FORM_NOT_REQUIRED, 'That question does not apply to this deal.',
      'Do not save it. Use ask_next_question to get the next question.');
  }
  const required = engine.requiredForms();
  for (const formCode of forms.filter(code => required.includes(code))) {
    const r = guardWrite({ role, deal, engine, formCode });
    if (r) return fail(r.error, r.message, r.next_step);
  }
  return null;
}

// The one fact in the call, or a ToolArgsError. Only these two strings are read; anything else the model sends is ignored.
function oneAnswer(args) {
  const list = args && args.answers;
  if (!Array.isArray(list) || list.length !== FACTS_PER_CALL) throw new ToolArgsError(BAD_SAVE_ARGS);
  const { field_name, value } = list[0] || {};
  if (typeof field_name !== 'string' || typeof value !== 'string' || !field_name.trim() || !value.trim()) {
    throw new ToolArgsError(BAD_SAVE_ARGS);
  }
  return { fieldName: field_name.trim(), value: value.trim() };
}

export function createTools({ repository, seenFields, inbox }) {
  async function getDeal({ turn }) {
    const deal = await repository.get(turn.dealId);
    if (!deal) return NO_DEAL;
    const { view, fieldNames } = viewOf(turn.role, deal);
    await seenFields.add({ dealId: turn.dealId, sessionId: turn.sessionId, role: turn.role }, fieldNames);
    // Only the broker's view has an inbox key, and it never carries the question text (ADR 0008, ticket 050).
    const data = turn.role === 'broker' && inbox ? { ...view, inbox: await inboxSummary(inbox, turn.dealId) } : view;
    return { ok: true, data: redactDeal(data), field_names: fieldNames };
  }

  // The question is chosen by the rules (unblock count, then question order). Nothing the model passes is read.
  async function askNextQuestion({ turn }) {
    const deal = await repository.get(turn.dealId);
    if (!deal) return NO_DEAL;
    const engine = engineFor(deal);
    const next = engine.nextByUnblock({
      skip: turn.role === 'seller' ? [] : ATTESTATION_FIELDS,
      formFilter: code => canAccessForm(turn.role, code),
    });
    if (!next) return { ok: true, data: redactDeal({ done: true, message: NO_QUESTIONS_LEFT }), field_names: [] };
    const { question: q, unblocks } = next;
    const fieldNames = [q.k];
    await seenFields.add({ dealId: turn.dealId, sessionId: turn.sessionId, role: turn.role }, fieldNames);
    const question = { field_name: q.k, text: q.q, type: q.type, why: q.why, ...(q.options ? { options: q.options } : {}) };
    return { ok: true, data: redactDeal({ question, unblocks }), field_names: fieldNames };
  }

  // Saves one answer through the rules and the repository. The deal and the role come only from the turn.
  async function saveAnswers({ turn, args }) {
    const { fieldName, value } = oneAnswer(args);
    const deal = await repository.get(turn.dealId);
    if (!deal) return NO_DEAL;
    deal.answers ||= {};
    const engine = engineFor(deal);
    const q = engine.QUESTIONS.find(x => x.k === fieldName);
    if (!q) throw new ToolArgsError(UNKNOWN_SAVE_FIELD);
    const refusal = checkWrite(turn.role, deal, engine, q);
    if (refusal) return refusal;

    const result = engine.answer(q.k, value, SOURCE_BY_ROLE[turn.role] ?? 'Chat answer');
    if (!result) throw new ToolArgsError(EMPTY_SAVE_VALUE);
    await repository.save(deal);

    // Filter to the role first, then redact. The forms a role cannot see are not named to it.
    const visible = codes => codes.filter(code => canAccessForm(turn.role, code));
    const { view, fieldNames } = viewOf(turn.role, deal);
    const names = [...new Set([q.k, ...fieldNames])];
    await seenFields.add({ dealId: turn.dealId, sessionId: turn.sessionId, role: turn.role }, names);
    return {
      ok: true,
      data: redactDeal({
        saved: { field_name: q.k, value },
        forms_added: visible(result.added),
        forms_removed: visible(result.removed),
        forms_filled: visible(result.filled),
        missing_fields: view.missing_fields,
      }),
      field_names: names,
    };
  }

  const getDealTool = name => ({
    definition: DEFINITIONS[name],
    // Arguments are ignored whatever they are, so they must not change the repeated-call key either.
    key: () => ({}),
    run: getDeal,
  });
  const implemented = { get_deal: getDealTool('get_deal'), get_deal_status: getDealTool('get_deal_status'),
    ask_next_question: { definition: DEFINITIONS.ask_next_question, key: () => ({}), run: askNextQuestion },
    // No `key`: the whole input counts, so sending the identical save again is the repeat the loop stops.
    save_answers: { definition: DEFINITIONS.save_answers, run: saveAnswers },
    ...(inbox ? { ask_broker: askBrokerTool({ inbox }) } : {}),
  };

  return {
    registry: implemented,
    // The tools offered to a role: its entry in ROLE_TOOLS, limited to those that are built.
    forRole(role) {
      return toolsFor(role).filter(n => Object.hasOwn(implemented, n));
    },
  };
}
