// modelGate: the one gate every model call passes through, and the only caller of callModel.
//
// Later tickets build AROUND this gate without changing it: 027b supplies the real callModel,
// 027d supplies the system prompt, 032 adds the loop and the tool limits by calling modelGate once
// per loop step. Keep the signature modelGate(turn, { system, tools, messages }) and the order below.
//
// Per call, in order:
//   1. per-turn count: the call after MODEL_CALLS_PER_TURN is refused (the daily cap is not taken)
//   2. dailyCap.take(): when it says no, the model is not called
//   3. logEvent model_call_start   4. callModel   5. validate the result   6. logEvent model_call_end
// A brake returns { stopped, reply } with a plain message; it never throws.
// A call returns { stopped: null, result }. logEvent redacts keys from every payload.
import { MODEL_CALLS_PER_TURN } from './config.js';
import { validateModelResult } from './model_interface.js';

export const CALL_LIMIT_REPLY =
  'I have reached the limit of steps I can take for one message. Please send a new message to continue.';
export const DAILY_CAP_REPLY =
  'The assistant has reached its daily limit of model calls. Please try again tomorrow.';

// Calls made per turn. Held here, keyed by the turn object, so no caller can reset a count.
const callsMade = new WeakMap();

// A turn's scope comes from the session, once, and cannot be changed afterwards.
export function createTurn({ sessionId, turnId, role, dealId }) {
  const turn = Object.freeze({ sessionId, turnId, role, dealId });
  callsMade.set(turn, 0);
  return turn;
}

export function createModelGate({ callModel, dailyCap, eventLog, perTurn = MODEL_CALLS_PER_TURN }) {
  return async function modelGate(turn, { system, tools, messages }) {
    if (!callsMade.has(turn)) throw new Error('modelGate needs a turn made by createTurn');
    const n = callsMade.get(turn) + 1;
    if (n > perTurn) return { stopped: 'call_limit', reply: CALL_LIMIT_REPLY };
    callsMade.set(turn, n);

    if (!(await dailyCap.take()).allowed) return { stopped: 'daily_cap', reply: DAILY_CAP_REPLY };

    const log = (type, payload) =>
      eventLog.logEvent(turn.sessionId, turn.turnId, turn.role, turn.dealId, type, { call: n, ...payload });
    await log('model_call_start', { system, tools, messages });
    let result;
    try {
      result = validateModelResult(await callModel({ system, tools, messages }));
    } catch (e) {
      await log('model_call_end', { error: String(e && e.message) });
      throw e;
    }
    await log('model_call_end', { content: result.content, stop_reason: result.stop_reason, usage: result.usage });
    return { stopped: null, result };
  };
}
