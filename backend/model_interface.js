// The one definition of the model client interface. Every model client (the scripted fake in tests,
// the real Messages API client in 027b) is a function with exactly this shape, and nothing else
// defines it:
//
//   callModel({ system, tools, messages }) -> Promise<{ content, stop_reason, usage }>
//     system:      string
//     tools:       array of tool definitions ([] until tools exist)
//     messages:    [{ role: 'user' | 'assistant', content }]
//     content:     array of blocks, each { type: string, ... } (text blocks carry { type: 'text', text })
//     stop_reason: string
//     usage:       object (token counts)
//
// Only modelGate (model_gate.js) calls a callModel.

export class ModelResultError extends Error {}

export function validateModelResult(result) {
  const fail = why => { throw new ModelResultError(`bad model result: ${why}`); };
  if (!result || typeof result !== 'object') fail('not an object');
  if (!Array.isArray(result.content)) fail('content must be an array');
  if (result.content.some(b => !b || typeof b.type !== 'string')) fail('every content block needs a type');
  if (typeof result.stop_reason !== 'string') fail('stop_reason must be a string');
  if (!result.usage || typeof result.usage !== 'object') fail('usage must be an object');
  return result;
}

// The plain text of a result: its text blocks joined.
export const replyText = result => result.content.filter(b => b.type === 'text').map(b => b.text).join('');
