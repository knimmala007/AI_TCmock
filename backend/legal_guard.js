// The code layer of "no legal advice" (ticket 030, ADR 0002). The prompt rule (CORE in prompts.js) is the
// first layer; this is the second: a check on the model's final reply that replaces anything that reads
// as legal, tax or financial advice with one fixed refusal. Best effort, not a guarantee: it looks for
// common shapes of advice, so a miss is added as a test and a pattern (ticket 030, criterion 4).
//
// The guard takes the reply and the session's role and nothing else, so no message, body field or tool
// result can switch it off. It does not call a tool: handing the question to a person is the refusal's wording.
import { ROLE_TOOLS } from './roles.js';
import { STATUS } from './status.js';

const ACTS = 'sign|waive|sue|accept|reject|decline|withdraw|cancel|rescind|terminate|contest|counter|refuse|walk away|back out|invest|refinance';

// Each pattern is a shape of advice or a legal conclusion. Plain statements of what is required or who
// must do a step ("the broker must approve", "California requires this disclosure") match none of them.
const ADVICE = [
  // "you should sign", "you must not waive": a directive to take a legal or financial step.
  new RegExp(`\\byou\\s+(?:should|must|need to|ought to|have to|had better)\\s+(?:not\\s+|definitely\\s+|absolutely\\s+|really\\s+)?(?:${ACTS})\\b`, 'i'),
  // "I'd advise you to sign", "I recommend that you accept"
  new RegExp(`\\b(?:advise|recommend|suggest|urge)\\s+(?:that\\s+)?you\\s+(?:to\\s+)?(?:not\\s+)?(?:${ACTS})\\b`, 'i'),
  // "I would sign", "I wouldn't waive"
  new RegExp(`\\bI\\s+(?:would|wouldn't|would not|'d)\\s+(?:definitely\\s+|certainly\\s+)?(?:${ACTS})\\b`, 'i'),
  // "it's a good idea to waive"
  new RegExp(`\\b(?:good|bad|wise|smart|safe|fine|risky)\\s+(?:idea|move|decision|call|choice)\\s+to\\s+(?:${ACTS})\\b`, 'i'),
  // "you can waive the contingency", "you could just back out"
  /\byou\s+(?:can|could|may)\s+(?:safely\s+|simply\s+|just\s+)?(?:waive|back out|walk away|sue|withhold|skip the (?:inspection|disclosure|disclosures))\b/i,
  // "you can legally", "you're legally entitled", "you are not legally required"
  /\byou\s+(?:can|could|may|cannot|can't|may not)\s+legally\b/i,
  /\byou(?:'re|\s+are|\s+aren't|\s+are not)\s+(?:not\s+)?legally\s+(?:allowed|entitled|permitted|required|obligated|liable|responsible)\b/i,
  // "you are liable", "you'll be off the hook", "you have a strong case"
  /\byou(?:'re|\s+are|\s+aren't|\s+are not|\s+would be|\s+will be)\s+(?:not\s+)?(?:liable|bound|obligated|off the hook|in the clear)\b/i,
  /\byou\s+(?:have|don't have|do not have)\s+(?:a\s+|no\s+)?(?:good\s+|strong\s+|valid\s+|solid\s+)?(?:case|claim|grounds|defense|remedy)\b/i,
  // "this clause is enforceable / void", "the waiver is not binding"
  /\b(?:clause|provision|term|waiver|contingency|addendum|agreement|contract|disclaimer|release)\s+(?:is|isn't|is not|would be|will be|may be|might be)\s+(?:legally\s+)?(?:enforceable|unenforceable|void|voidable|invalid|illegal|unlawful|binding|valid)\b/i,
  // "this clause means you give up your right to ..."
  /\b(?:this|that|the)\s+(?:clause|provision|term|waiver|contingency|addendum)\s+(?:means|gives|waives|releases|obligates|binds|lets|allows)\s+(?:that\s+)?(?:you|the\s+(?:buyer|seller))\b/i,
  // "under California law, ...", "the statute says ..."
  /\b(?:under|according to|by)\s+(?:the\s+)?(?:california|state|federal|local)?\s*(?:law|statute|civil code|case law)\b/i,
  /\b(?:the\s+)?(?:statute|law|civil code|court)\s+(?:says|states|means|provides|holds|rules)\b/i,
  // an opinion offered as legal advice
  /\b(?:my|in my|here'?s my|here is my)\s+(?:legal\s+)?(?:legal advice|legal opinion|opinion as)\b/i,
  /\bas your (?:lawyer|attorney|tax advisor|financial advisor)\b/i,
  // tax
  /\byou\s+(?:can|could|may|will|would)\s+(?:deduct|write off|avoid (?:paying )?(?:the\s+)?tax|owe (?:the\s+)?(?:\w+\s+){0,3}tax)/i,
];

export const looksLikeLegalAdvice = reply => typeof reply === 'string' && ADVICE.some(p => p.test(reply));

const REFUSAL = 'I can\'t give legal, tax or financial advice, or interpret a contract or a law. That needs a person\'s judgment.';
export const REFUSAL_ASK_BROKER = `${REFUSAL} Please ask your broker.`;
export const REFUSAL_BROKER = `${REFUSAL} Please take it to a licensed real-estate attorney or tax advisor.`;

// The text points to a person. A role with ask_broker is told to ask the broker; the broker is not.
export const legalRefusal = role => ((ROLE_TOOLS[role] || []).includes('ask_broker') ? REFUSAL_ASK_BROKER : REFUSAL_BROKER);

// {reply, status}: the fixed refusal and LEGAL_JUDGMENT when the reply looks like advice, otherwise the reply as it is.
export function guardReply({ role, reply }) {
  if (looksLikeLegalAdvice(reply)) return { reply: legalRefusal(role), status: STATUS.LEGAL_JUDGMENT };
  return { reply, status: null };
}
