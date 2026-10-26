// runLoop: the hand-written tool-use loop. Ask the model, run the tools it calls, send the results
// back, and repeat until it answers in text or a limit stops the turn.
//
// Every model call goes through modelGate; the loop never calls a client. The turn (role, deal,
// session) was made from the session and is passed to every tool; nothing the model writes can change it.
//
// Returns { stopped, reply }. stopped is null for a reply to save, or a reason to pass up unsaved:
// a gate stop ('call_limit', 'daily_cap') comes straight from modelGate; the loop adds
// 'tool_call_limit' and 'repeat_call'. The limits are in config.js (MODEL_CALLS_PER_TURN is
// enforced by the gate). Per-tool-call and tool-result logging is not built (ticket 062).
import { REPEATED_CALL_LIMIT, TOOL_CALLS_PER_TURN } from './config.js';
import { replyText } from './model_interface.js';

export const TOOL_CALL_LIMIT_REPLY =
  'I have reached the limit of tool calls I can make for one message. Please send a new message to continue.';
export const REPEAT_CALL_REPLY =
  'I was repeating the same step without getting anywhere, so I stopped. Please rephrase your message or ask something else.';
export const TRUNCATED_REPLY = 'My answer was cut off before it was finished. Please ask again, or ask for a shorter answer.';
export const EMPTY_REPLY = 'I could not put together an answer. Please try asking again.';

export const STUB_TEXT = 'The stub tool works.';

// The one stub tool (ticket 027c): read-only, fixed text, touches no deal data. Ticket 031 replaces it.
export const STUB_TOOL = {
  name: 'stub_ping',
  description: 'Returns a fixed line of text. Reads nothing and changes nothing.',
  input_schema: { type: 'object', properties: { topic: { type: 'string' } }, additionalProperties: false },
};

// name -> { definition, run({ turn, args }) }. A tool throws to say its arguments are bad.
export const TOOL_REGISTRY = {
  stub_ping: {
    definition: STUB_TOOL,
    run({ args }) {
      const isObject = args && typeof args === 'object' && !Array.isArray(args);
      if (!isObject || Object.keys(args).some(k => k !== 'topic') || ('topic' in args && typeof args.topic !== 'string')) {
        throw new Error('stub_ping takes an optional text "topic" and nothing else');
      }
      return STUB_TEXT;
    },
  },
};

// The same JSON whatever the key order, so {a,b} and {b,a} are one call.
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

// Runs one tool_use block. A bad name or bad arguments become an error result, not a stopped turn.
async function runTool(registry, turn, block) {
  const tool = Object.hasOwn(registry, block.name) ? registry[block.name] : null;
  const result = { type: 'tool_result', tool_use_id: block.id };
  if (!tool) return { ...result, is_error: true, content: `No tool named "${block.name}" is available.` };
  try {
    return { ...result, content: String(await tool.run({ turn, args: block.input })) };
  } catch (e) {
    return { ...result, is_error: true, content: String(e && e.message) };
  }
}

export async function runLoop(modelGate, turn, { system, messages, registry = TOOL_REGISTRY }) {
  const tools = Object.values(registry).map(t => t.definition);
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
    if (toolCalls > TOOL_CALLS_PER_TURN) return { stopped: 'tool_call_limit', reply: TOOL_CALL_LIMIT_REPLY };
    for (const block of blocks) {
      const key = `${block.name} ${canonical(block.input)}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      if (seen.get(key) > REPEATED_CALL_LIMIT) return { stopped: 'repeat_call', reply: REPEAT_CALL_REPLY };
    }
    const results = [];
    for (const block of blocks) results.push(await runTool(registry, turn, block));
    thread.push({ role: 'assistant', content }, { role: 'user', content: results });
  }
}
