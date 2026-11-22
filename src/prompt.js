// Builds the model prompt and parses the model's JSON answer.
// Kept free of browser APIs so it can be unit tested in Node.
import { stripDashes } from './rules.js';

export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          quote: { type: 'string' },
          problem: { type: 'string' },
          fix: { type: 'string' }
        },
        required: ['quote', 'problem', 'fix']
      }
    },
    rewrite: { type: 'string' }
  },
  required: ['issues', 'rewrite']
};

export function buildPrompt(draft, precheckIssues) {
  const hints = precheckIssues.length
    ? precheckIssues
        .map((i) => `- [${i.kind}] ${i.message}${i.quote ? ` (sentence: "${i.quote}")` : ''}`)
        .join('\n')
    : '- none';

  return [
    'You are an editor who checks LinkedIn post drafts for credibility before they are published.',
    'Find: claims with no source (numbers, superlatives, named results), vague or generic hooks, and missing context (no timeframe, no baseline, unclear who it is for).',
    'Rules for the rewrite:',
    '1. Keep the author\'s voice, meaning and length roughly the same.',
    '2. Never invent a source, a number, a name or a result.',
    '3. If a claim needs a source the draft does not give, either insert the placeholder [source: add link] right after it, or soften it (for example "one of the" instead of "the best", "in our data" instead of a bare number).',
    '4. Do not use em dashes or en dashes anywhere.',
    '5. Plain text only, no markdown, no hashtags unless the draft already has them.',
    '',
    'A rule-based pre-check already flagged these points:',
    hints,
    '',
    'Answer only with JSON of this shape:',
    '{"issues":[{"quote":"exact words from the draft","problem":"what is wrong","fix":"how to fix it"}],"rewrite":"the full revised post"}',
    'Return at most 6 issues, most important first.',
    '',
    'Draft:',
    '"""',
    draft,
    '"""'
  ].join('\n');
}

/** Parse the model output into {issues, rewrite}. Tolerates code fences and stray text. */
export function parseModelOutput(raw) {
  const text = String(raw || '').trim();
  let candidate = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');
  if (first !== -1 && last > first) candidate = candidate.slice(first, last + 1);
  let data;
  try {
    data = JSON.parse(candidate);
  } catch {
    return { issues: [], rewrite: stripDashes(text), parsed: false };
  }
  const issues = Array.isArray(data.issues)
    ? data.issues
        .filter((i) => i && typeof i === 'object')
        .slice(0, 6)
        .map((i) => ({
          quote: stripDashes(String(i.quote || '')),
          problem: stripDashes(String(i.problem || '')),
          fix: stripDashes(String(i.fix || ''))
        }))
    : [];
  return { issues, rewrite: stripDashes(String(data.rewrite || '')), parsed: true };
}
