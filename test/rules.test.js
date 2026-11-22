import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findNumbers,
  findSuperlatives,
  hasSource,
  checkHook,
  precheck,
  splitSentences,
  stripDashes
} from '../src/rules.js';
import { parseModelOutput, buildPrompt } from '../src/prompt.js';

const matches = (arr) => arr.map((x) => x.match.toLowerCase());

test('detects percentages, money, multipliers and magnitudes', () => {
  const found = matches(findNumbers('We grew 312% and closed $1.2M, a 3x jump, with 40k signups and ₹5 lakh saved.'));
  assert.ok(found.includes('312%'));
  assert.ok(found.some((f) => f.startsWith('$1.2m')));
  assert.ok(found.includes('3x'));
  assert.ok(found.includes('40k'));
  assert.ok(found.some((f) => f.startsWith('₹5 lakh')));
});

test('detects counts followed by a noun', () => {
  const found = matches(findNumbers('I interviewed 47 founders last month.'));
  assert.deepEqual(found, ['47 founders']);
});

test('ignores years, list markers, times and non-claim counts', () => {
  assert.deepEqual(findNumbers('In 2024 I started.'), []);
  assert.deepEqual(findNumbers('1. Write daily\n2. Edit later'), []);
  assert.deepEqual(findNumbers('The call is at 10:30 am.'), []);
  assert.deepEqual(findNumbers('Here are 5 lessons I learned.'), []);
  assert.deepEqual(findNumbers('It took 20 minutes.'), []);
});

test('detects superlatives and absolute words', () => {
  const found = matches(findSuperlatives('This is the best tool and the only one that always works. #1 in India.'));
  assert.ok(found.includes('best'));
  assert.ok(found.includes('the only'));
  assert.ok(found.includes('always'));
  assert.ok(found.includes('#1'));
});

test('does not flag words that merely contain a superlative', () => {
  assert.deepEqual(findSuperlatives('Our interest in testing the bestseller list is honest.'), []);
  assert.deepEqual(findSuperlatives('A topical post with stopped motion.'), []);
});

test('recognises visible source markers', () => {
  assert.ok(hasSource('Churn fell 20% according to the 2025 Gartner survey.'));
  assert.ok(hasSource('Churn fell 20% (source: https://example.com/report).'));
  assert.ok(hasSource('Churn fell 20% per HubSpot.'));
  assert.equal(hasSource('Churn fell 20%.'), false);
});

test('flags stock hooks and long first lines', () => {
  assert.equal(checkHook("I'm excited to announce our new feature")[0].kind, 'vague-hook');
  assert.equal(checkHook("In today's fast-paced world, content matters").length, 1);
  assert.equal(checkHook('We cut onboarding from 9 days to 2.').length, 0);
  const long = Array(30).fill('word').join(' ');
  assert.equal(checkHook(long)[0].severity, 'low');
});

test('precheck flags unsourced numbers and superlatives but not sourced ones', () => {
  const draft = [
    'We are the fastest growing agency in India.',
    'Revenue grew 300%.',
    'According to the 2025 LinkedIn B2B report, 75% of buyers check a founder profile.',
    'Here is what I changed and why it matters for founders who post weekly and want inbound leads.'
  ].join('\n');
  const { issues, stats } = precheck(draft);
  const kinds = issues.map((i) => i.kind);
  assert.ok(kinds.includes('unsourced-superlative'));
  assert.ok(kinds.includes('unsourced-number'));
  assert.ok(!issues.some((i) => i.kind === 'unsourced-number' && i.quote.includes('75%')));
  assert.ok(issues.some((i) => i.kind === 'missing-context' && i.quote === 'Revenue grew 300%.'));
  assert.equal(stats.unsourcedClaims, 2);
});

test('precheck accepts results that carry a timeframe and baseline', () => {
  const { issues } = precheck('Our own data: demo bookings grew 40% from 50 to 70 a month in Q3 2025, per our CRM export. Here is the exact process we followed, step by step, so you can copy it.');
  assert.ok(!issues.some((i) => i.kind === 'missing-context'));
  assert.ok(!issues.some((i) => i.kind === 'unsourced-number'));
});

test('precheck on empty input returns nothing', () => {
  assert.deepEqual(precheck('   ').issues, []);
});

test('splitSentences keeps offsets', () => {
  const s = splitSentences('One. Two!\nThree?');
  assert.deepEqual(s.map((x) => x.text), ['One.', 'Two!', 'Three?']);
  assert.equal(s[1].start, 5);
});

test('stripDashes removes em and en dashes', () => {
  assert.equal(stripDashes('Fast \u2014 and cheap 2020\u20132024'), 'Fast, and cheap 2020-2024');
});

test('parseModelOutput handles fenced JSON and strips dashes', () => {
  const raw = '```json\n{"issues":[{"quote":"best","problem":"Unsourced \u2014 claim","fix":"Soften"}],"rewrite":"One of the better tools \u2014 in our tests."}\n```';
  const out = parseModelOutput(raw);
  assert.equal(out.parsed, true);
  assert.equal(out.issues[0].problem, 'Unsourced, claim');
  assert.ok(!out.rewrite.includes('\u2014'));
});

test('parseModelOutput falls back to raw text when not JSON', () => {
  const out = parseModelOutput('Not JSON at all');
  assert.equal(out.parsed, false);
  assert.equal(out.rewrite, 'Not JSON at all');
});

test('buildPrompt includes the draft and the pre-check hints', () => {
  const p = buildPrompt('We are #1.', [{ kind: 'unsourced-superlative', message: 'x', quote: 'We are #1.' }]);
  assert.ok(p.includes('We are #1.'));
  assert.ok(p.includes('[unsourced-superlative]'));
  assert.ok(p.includes('Never invent a source'));
});
