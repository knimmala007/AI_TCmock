// A test-only tool for the loop and handler tests: fixed text, touches no deal data.
// Tests pass it to the handler as an injected registry; the real registry is built in tools.js.
import { ToolArgsError } from '../agent_loop.js';

export const STUB_TEXT = 'The stub tool works.';

export const STUB_TOOL = {
  name: 'stub_ping',
  description: 'Returns a fixed line of text. Reads nothing and changes nothing.',
  input_schema: { type: 'object', properties: { topic: { type: 'string' } }, additionalProperties: false },
};

export const stubRegistry = () => ({
  stub_ping: {
    definition: STUB_TOOL,
    run({ args }) {
      const isObject = args && typeof args === 'object' && !Array.isArray(args);
      if (!isObject || Object.keys(args).some(k => k !== 'topic') || ('topic' in args && typeof args.topic !== 'string')) {
        throw new ToolArgsError('stub_ping takes an optional text "topic" and nothing else');
      }
      return STUB_TEXT;
    },
  },
});
