// runLoop: the hand-written tool-use loop. Ask the model, run the tools it calls, send the results
// back, and repeat until it answers in text or a limit stops the turn.
//
// Every model call goes through modelGate; the loop never calls a client. The turn (role, deal,
// session) was made from the session and is passed to every tool; nothing the model writes can change it.
//
// Returns { stopped, reply }. stopped is null for a reply to save, or a reason to pass up unsaved:
// a gate stop ('call_limit', 'daily_cap') comes straight from modelGate; the loop adds
// 'tool_call_limit' and 'repeat_call'. The limits are in config.js (MODEL_CALLS_PER_TURN is
// enforced by the gate). Each tool call logs tool_start and tool_end, and a loop stop logs turn_refused (ticket 062).
// These events carry the tool name, the call id, and counts only: no arguments and no result text.
import { REPEATED_CALL_LIMIT, TOOL_CALLS_PER_TURN } from './config.js';
import { replyText } from './model_interface.js';

export const TOOL_CALL_LIMIT_REPLY =
  'I have reached the limit of tool calls I can make for one message. Please send a new message to continue.';
export const REPEAT_CALL_REPLY =
  'I was repeating the same step without getting anywhere, so I stopped. Please rephrase your message or ask something else.';
export const TRUNCATED_REPLY = 'My answer was cut off before it was finished. Please ask again, or ask for a shorter answer.';
export const EMPTY_REPLY = 'I could not put together an answer. Please try asking again.';

// A tool throws this to say its arguments are bad; the message goes back to the model.
// Any other thrown error becomes a fixed line, so no message can carry data outside the role's view (R23).
export class ToolArgsError extends Error {}
export const TOOL_NOT_ALLOWED = 'That tool is not available to your role.';
export const TOOL_FAILED = 'The tool failed. Try something else or tell the user.';

// name -> { definition, run({ turn, args }), key?(args) }. A tool returns a string or an object, which the
// loop sends as JSON. `key` says which of the arguments make a call "the same" for the repeat stop;
// without it the whole input counts. The registry for a turn is built per role (tools.js).

// The same JSON whatever the key order, so {a,b} and {b,a} are one call.
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

// Runs one tool_use block. A bad name or bad arguments become an error result, not a stopped turn.
async function runTool(registry, turn, block, allowed, log) {
  const tool = Object.hasOwn(registry, block.name) ? registry[block.name] : null;
  // A name the model invented is not logged as written.
  const base = { tool: tool ? block.name : 'unknown_tool', tool_use_id: block.id };
  await log('tool_start', base);
  const done = await execTool(registry, turn, block, allowed, tool);
  await log('tool_end', { ...base, is_error: Boolean(done.is_error), result_chars: done.content.length });
  return done;
}

async function execTool(registry, turn, block, allowed, tool) {
  const result = { type: 'tool_result', tool_use_id: block.id };
  if (!tool) return { ...result, is_error: true, content: `No tool named "${block.name}" is available.` };
  if (allowed && !allowed.includes(block.name)) return { ...result, is_error: true, content: TOOL_NOT_ALLOWED };
  try {
    const out = await tool.run({ turn, args: block.input });
    const text = typeof out === 'string' ? out : JSON.stringify(out);
    return out && out.ok === false ? { ...result, is_error: true, content: text } : { ...result, content: text };
  } catch (e) {
    return { ...result, is_error: true, content: e instanceof ToolArgsError ? e.message : TOOL_FAILED };
  }
}

export async function runLoop(modelGate, turn, { system, messages, registry = {}, allowed = null, eventLog = null }) {
  const log = async (type, payload) => {
    if (eventLog) await eventLog.logEvent(turn.sessionId, turn.turnId, turn.role, turn.dealId, type, payload);
  };
  // `allowed` is the names the turn's role may use (from its frozen role); without it every registry tool is offered.
  const tools = Object.entries(registry).filter(([n]) => !allowed || allowed.includes(n)).map(([, t]) => t.definition);
  const thread = [...messages];
  const seen = new Map(); // canonical call -> times made
  let toolCalls = 0;

  for (;;) {
    const r = await modelGate(turn, { system, tools, messages: thread });
    if (r.stopped) return r;
    const { content, stop_reason } = r.result;
    const blocks = content.filter(b => b.type === 'tool_use');

    if (stop_reason !== 'tool_use') {
      if (stop_reason === 'max_tokens') return { stopped: null, reply: TRUNCATED_REPLY };
      return { stopped: null, reply: replyText(r.result).trim() ? replyText(r.result) : EMPTY_REPLY };
    }
    if (!blocks.length) return { stopped: null, reply: EMPTY_REPLY };

    // All or nothing: the whole message is checked against both limits before any of its tools
    // runs, so a stop runs none of them and nothing is sent back.
    toolCalls += blocks.length;
    if (toolCalls > TOOL_CALLS_PER_TURN) {
      await log('turn_refused', { reason: 'tool_call_limit', tool_calls: toolCalls });
      return { stopped: 'tool_call_limit', reply: TOOL_CALL_LIMIT_REPLY };
    }
    for (const block of blocks) {
      const tool = Object.hasOwn(registry, block.name) ? registry[block.name] : null;
      const key = `${block.name} ${canonical(tool && tool.key ? tool.key(block.input) : block.input)}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      if (seen.get(key) > REPEATED_CALL_LIMIT) {
        await log('turn_refused', { reason: 'repeat_call', tool: tool ? block.name : 'unknown_tool' });
        return { stopped: 'repeat_call', reply: REPEAT_CALL_REPLY };
      }
    }
    const results = [];
    for (const block of blocks) results.push(await runTool(registry, turn, block, allowed, log));
    thread.push({ role: 'assistant', content }, { role: 'user', content: results });
  }
}
