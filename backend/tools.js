// The tools the model can call (ADR 0008). Every tool returns the one envelope
// {ok, data?, error?: {code, message, next_step}, field_names?}.
//
// The deal and the role come only from the frozen turn (made from the session); a tool's arguments
// are never read for either. Everything the model sees is filtered by role (roles.js) and then
// passed through redactDeal (safety.js). Error text is fixed and carries no deal data (reminders R23).
import { createEngine } from '../rules.js';
import { MAX_FACTS_PER_SAVE, isTestedJurisdiction } from './config.js';
import { ToolArgsError } from './agent_loop.js';
import { DOCS } from './fixtures.js';
import { canAccessForm, stageFor, toolsFor } from './roles.js';
import { redactDeal } from './safety.js';
import { askBrokerTool, inboxSummary } from './inbox.js';
import { approvalTools, latestHandoffNote } from './approvals.js';
import { STATUS, fail, guardWrite } from './status.js';

// ADR 0008 defines no "not found" code (ten status codes plus UNKNOWN_TOOL, BAD_ARGS, UNKNOWN_FIELD, TURN_LIMIT).
// NOT_FOUND is a PROVISIONAL code until the owner decides; the text is fixed and carries no data.
export const NO_DEAL = fail('NOT_FOUND', 'No deal file is available for this session.',
  'Tell the user the deal could not be loaded and stop.');

// A form the rules require but DOCS does not define (ticket 018, R9). The agent flags it and never fills it.
const hasTemplate = code => DOCS.some(x => x.code === code);

// PROVISIONAL transport code, like NOT_FOUND: not one of the ten status codes, pending ticket 024. ok is true only
// when something was stored, so a fact that feeds only untemplated forms is ok: false. The text is fixed and carries no data.
export const NO_TEMPLATE = fail('NO_TEMPLATE', 'Not saved. The form this answer belongs to has no template yet, so it cannot be filled.',
  'Do not retry: the form needs a template, and nothing the user says will change that. Use ask_next_question for the next question.');

// PROVISIONAL transport code, like NO_TEMPLATE: not one of the ten status codes, pending ticket 024. A deal outside the
// tested list gets this and no rules (ticket 038, ADR 0002). ok is false: nothing was stored. The text is fixed and
// names neither the city nor the county, so it carries no deal data.
export const UNTESTED_JURISDICTION = fail('UNTESTED_JURISDICTION',
  'This deal is in a jurisdiction the assistant has not been tested on, so it gives no rules or form guidance for it.',
  'Tell the user a transaction coordinator must handle this deal, and stop. Do not call other rule-based tools.');

// The one jurisdiction check, run right after a deal loads and before anything is read, added to the seen set or saved.
const isUntested = deal => !isTestedJurisdiction(deal.city, deal.county);

// Seller certifications (ADR 0010): only the seller session is asked them. Every other role skips them and
// never counts them as candidates. Ticket 039 enforces the save side; the list is a constant here, not a rules.js flag.
export const ATTESTATION_FIELDS = Object.freeze(['waterHeater', 'smokeAlarm', 'coDetector']);
export const NO_QUESTIONS_LEFT = 'No unanswered questions are left for this deal.';
// Only untemplated-form questions remain. Fixed text: no deal data and no form names.
export const ONLY_UNTEMPLATED_LEFT = 'No more questions can be asked right now. Some forms still need a template, so they cannot be filled yet.';

// The required forms a fact feeds that this role may see, split by whether the form has a template. The one rule
// behind checkWrite (refuse or save), flaggedFormsOf (what is reported) and ask_next_question (what is offered).
function formsFedBy(role, engine, q) {
  const required = engine.requiredForms().filter(code => (q.fills || []).includes(code) && canAccessForm(role, code));
  return { templated: required.filter(hasTemplate), flagged: required.filter(code => !hasTemplate(code)) };
}
const feedsOnlyUntemplated = (role, engine, q) => {
  const { templated, flagged } = formsFedBy(role, engine, q);
  return flagged.length > 0 && !templated.length;
};

// Questions that feed only forms with no template are never offered: save_answers would refuse the answer (NO_TEMPLATE),
// so asking would send the model round in a circle. Same rule as checkWrite, so the two cannot disagree.
const untemplatedOnly = (role, engine) => engine.QUESTIONS.filter(q => feedsOnlyUntemplated(role, engine, q)).map(q => q.k);

// No input: the deal and the role are not arguments, so nothing the model passes is read.
const NO_INPUT = { type: 'object', properties: {}, additionalProperties: false };

// Where a chat answer came from (ADR 0010). It must not start with "Derived": the rules overwrite those.
const SOURCE_BY_ROLE = Object.freeze({ seller: 'Seller chat answer', broker: 'Broker chat answer' });

const BAD_SAVE_ARGS = `save_answers takes {"answers": [{"field_name": text, "value": text}]} with 1 to ${MAX_FACTS_PER_SAVE} answers, each field name once.`;
const UNKNOWN_SAVE_FIELD = 'That field name is not a question on this deal. Use ask_next_question to get the next one.';
const EMPTY_SAVE_VALUE = 'That answer was empty, so nothing was saved.';

// A name the model was never shown (ticket 036, the invented-field-name bug). The message lists only names this
// session's seen set already holds; it never echoes the name that was tried, and never lists the full question list.
const UNSEEN_NEXT_STEP = 'Use only a field name from ask_next_question or get_deal.';
function unseenField(seen) {
  const names = [...seen].sort();
  const message = names.length
    ? `That field name has not been given to you. Valid field names: ${names.join(', ')}.`
    : 'That field name has not been given to you, and you have been given none yet. Call get_deal or ask_next_question first.';
  return fail('UNKNOWN_FIELD', message, UNSEEN_NEXT_STEP);
}

const DEFINITIONS = {
  save_answers: {
    name: 'save_answers',
    description: `Saves answers the user has just given to questions from ask_next_question: up to ${MAX_FACTS_PER_SAVE} ` +
      'per call, each field name once. Pass each field name exactly as it was given to you and the answer in the user\'s ' +
      'words. Returns the forms this added, removed and filled, and what is still missing. Never guess an answer the user has not given.',
    input_schema: {
      type: 'object',
      properties: {
        answers: {
          type: 'array', minItems: 1, maxItems: MAX_FACTS_PER_SAVE,
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
  // The next role sees who handed off and when, never the earlier chat (ADR 0011). Which forms it sees is still
  // decided by its role; filtering by release is ticket 047.
  const handoff = role === 'broker' ? null : latestHandoffNote(deal, role);

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
      ...(handoff ? { handoff } : {}),
      fields,
      missing_fields: missing,
      forms: docs.map(d => ({
        code: d.code,
        name: d.name,
        ready: engine.formReady(d.code),
        // A required form with no template is flagged, never filled (ticket 018).
        has_template: hasTemplate(d.code),
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
  // A fact that feeds only forms with no template is flagged and not saved. A fact that also feeds a templated form is
  // saved; the guards run on the templated forms only, and the untemplated ones are reported as flagged.
  if (feedsOnlyUntemplated(role, engine, q)) return NO_TEMPLATE;
  const { templated } = formsFedBy(role, engine, q);
  for (const formCode of templated) {
    const r = guardWrite({ role, deal, engine, formCode });
    if (r) return fail(r.error, r.message, r.next_step);
  }
  return null;
}

// The required forms this fact feeds that have no template, limited to the role's view. Never filled.
const flaggedFormsOf = (role, engine, q) => formsFedBy(role, engine, q).flagged;

// The facts in the call, or a ToolArgsError before anything is read or written: 1 to MAX_FACTS_PER_SAVE answers, each a
// non-empty field name and value, no field name twice. Only these two strings are read; anything else is ignored.
function factsOf(args) {
  const list = args && args.answers;
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_FACTS_PER_SAVE) throw new ToolArgsError(BAD_SAVE_ARGS);
  const facts = list.map(item => {
    const { field_name, value } = item || {};
    if (typeof field_name !== 'string' || typeof value !== 'string' || !field_name.trim() || !value.trim()) {
      throw new ToolArgsError(BAD_SAVE_ARGS);
    }
    return { fieldName: field_name.trim(), value: value.trim() };
  });
  if (new Set(facts.map(f => f.fieldName)).size !== facts.length) throw new ToolArgsError(BAD_SAVE_ARGS);
  return facts;
}

export function createTools({ repository, seenFields, inbox }) {
  async function getDeal({ turn }) {
    const deal = await repository.get(turn.dealId);
    if (!deal) return NO_DEAL;
    if (isUntested(deal)) return UNTESTED_JURISDICTION;
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
    if (isUntested(deal)) return UNTESTED_JURISDICTION;
    const engine = engineFor(deal);
    const roleSkip = turn.role === 'seller' ? [] : ATTESTATION_FIELDS;
    const formFilter = code => canAccessForm(turn.role, code);
    const next = engine.nextByUnblock({ skip: [...roleSkip, ...untemplatedOnly(turn.role, engine)], formFilter });
    if (!next) {
      // Say why: a question was held back only because its forms have no template, or every question is answered.
      const held = engine.nextByUnblock({ skip: roleSkip, formFilter });
      const message = held ? ONLY_UNTEMPLATED_LEFT : NO_QUESTIONS_LEFT;
      return { ok: true, data: redactDeal({ done: true, message }), field_names: [] };
    }
    const { question: q, unblocks } = next;
    const fieldNames = [q.k];
    await seenFields.add({ dealId: turn.dealId, sessionId: turn.sessionId, role: turn.role }, fieldNames);
    const question = { field_name: q.k, text: q.q, type: q.type, why: q.why, ...(q.options ? { options: q.options } : {}) };
    return { ok: true, data: redactDeal({ question, unblocks }), field_names: fieldNames };
  }

  // Saves 1 to MAX_FACTS_PER_SAVE answers through the rules and the repository, one save at the end. Each fact runs the
  // same guards in order against the deal as the earlier facts left it. The deal and the role come only from the turn.
  async function saveAnswers({ turn, args }) {
    const facts = factsOf(args);
    const deal = await repository.get(turn.dealId);
    if (!deal) return NO_DEAL;
    if (isUntested(deal)) return UNTESTED_JURISDICTION;
    deal.answers ||= {};
    const engine = engineFor(deal);
    const scope = { dealId: turn.dealId, sessionId: turn.sessionId, role: turn.role };
    // The seen set as it stands before the call: a fact in a batch cannot make another fact seen.
    const seen = new Set(await seenFields.list(scope));
    const single = facts.length === 1;
    const done = []; // per fact, in order: { refusal } or { q, value, result }

    for (const { fieldName, value } of facts) {
      if (!seen.has(fieldName)) { done.push({ refusal: unseenField(seen) }); continue; }
      const q = engine.QUESTIONS.find(x => x.k === fieldName);
      if (!q) {
        if (single) throw new ToolArgsError(UNKNOWN_SAVE_FIELD);
        done.push({ refusal: fail('UNKNOWN_FIELD', UNKNOWN_SAVE_FIELD, UNSEEN_NEXT_STEP) });
        continue;
      }
      const refusal = checkWrite(turn.role, deal, engine, q);
      if (refusal) { done.push({ refusal }); continue; }
      const result = engine.answer(q.k, value, SOURCE_BY_ROLE[turn.role] ?? 'Chat answer');
      if (!result) {
        if (single) throw new ToolArgsError(EMPTY_SAVE_VALUE);
        done.push({ refusal: fail('BAD_ARGS', EMPTY_SAVE_VALUE, 'Ask the user for the answer again.') });
        continue;
      }
      done.push({ q, value, result });
    }

    const stored = done.filter(d => !d.refusal);
    // Nothing stored: the first refusal's own envelope (for one fact, exactly what it always was).
    if (!stored.length) return done[0].refusal;
    await repository.save(deal);

    // Filter to the role first, then redact. The forms a role cannot see are not named to it.
    const visible = codes => codes.filter(code => canAccessForm(turn.role, code));
    const { view, fieldNames } = viewOf(turn.role, deal);
    const names = [...new Set([...stored.map(d => d.q.k), ...fieldNames])];
    await seenFields.add(scope, names);
    const outcome = d => ({
      saved: { field_name: d.q.k, value: d.value },
      forms_added: visible(d.result.added),
      forms_removed: visible(d.result.removed),
      forms_filled: visible(d.result.filled).filter(hasTemplate),
      flagged_forms: flaggedFormsOf(turn.role, engine, d.q),
    });
    const data = single
      ? { ...outcome(stored[0]), missing_fields: view.missing_fields }
      : {
        // A refused fact is named by its position, never by the name that was tried.
        results: done.map((d, index) => d.refusal ? { index, ok: false, error: d.refusal.error } : { index, ok: true, ...outcome(d) }),
        missing_fields: view.missing_fields,
      };
    return { ok: true, data: redactDeal(data), field_names: names };
  }

  // request_approval and hand_off load the deal themselves (approvals.js), so the check wraps them here: it reads the
  // deal once, ahead of the tool, and the tool runs only for a tested jurisdiction.
  function guardedApprovalTools() {
    const tools = approvalTools({ repository, noDeal: NO_DEAL });
    return Object.fromEntries(Object.entries(tools).map(([name, tool]) => [name, {
      ...tool,
      run: async ctx => {
        const deal = await repository.get(ctx.turn.dealId);
        if (!deal) return NO_DEAL;
        if (isUntested(deal)) return UNTESTED_JURISDICTION;
        return tool.run(ctx);
      },
    }]));
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
    ...guardedApprovalTools(),
  };

  return {
    registry: implemented,
    // The tools offered to a role: its entry in ROLE_TOOLS, limited to those that are built.
    forRole(role) {
      return toolsFor(role).filter(n => Object.hasOwn(implemented, n));
    },
  };
}
