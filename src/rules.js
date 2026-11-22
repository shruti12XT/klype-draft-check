// Rule-based pre-checks. Pure functions, no network, no storage.
// They run instantly before the model call and their findings are passed
// to the model so it can focus its rewrite on the right sentences.

const SUPERLATIVES = [
  'best', 'worst', 'number one', '#1', 'no. 1', 'the only', 'first ever', 'first-ever',
  'fastest', 'biggest', 'largest', 'highest', 'lowest', 'cheapest', 'easiest',
  'greatest', 'strongest', 'smartest', 'most', 'top', 'leading', 'world-class',
  'world class', 'unprecedented', 'unmatched', 'unbeatable', 'guaranteed',
  'revolutionary', 'game-changing', 'game changer', 'industry-leading',
  'best-in-class', 'every single', 'everyone', 'nobody', 'always', 'never',
  '100% of', 'all of them'
];

const RESULT_VERBS = [
  'increased', 'grew', 'doubled', 'tripled', 'quadrupled', 'boosted', 'generated',
  'saved', 'cut', 'reduced', 'raised', 'closed', 'drove', 'delivered', 'added',
  'improved', 'scaled', 'hit', 'reached', 'achieved', 'landed', '10x', '10x\'d'
];

const SOURCE_MARKERS = [
  /https?:\/\/\S+/i,
  /\bwww\.\S+/i,
  /\baccording to\b/i,
  /\bsource[s]?\s*:/i,
  /\bper (the |a |an )?[A-Z][\w&-]*/,
  /\b(per|from|in) (our|my) (own )?(data|numbers|crm|dashboard|analytics|records|export)\b/i,
  /\b(our|my) (own|internal) (data|numbers|analytics)\b/i,
  /\b(report|study|survey|research|paper|dataset|data from|analysis)\b/i,
  /\[\d+\]/,
  /\((19|20)\d{2}\)/,
  /\bvia\s+[A-Z@]/
];

const VAGUE_HOOKS = [
  /^i('| a)m (so )?(excited|thrilled|humbled|delighted|happy|proud) to/i,
  /^in today'?s (fast[- ]paced|digital|ever[- ]changing|competitive)/i,
  /^let'?s talk about/i,
  /^here'?s the thing/i,
  /^(hot take|unpopular opinion)\b/i,
  /^did you know\b/i,
  /^(big|exciting) news\b/i,
  /^as an? [a-z]+(,|\s)/i,
  /^(so,? )?i (want|wanted) to share/i,
  /^this is (huge|big|important)\b/i,
  /^(game[- ]changer|mind[- ]blown)\b/i,
  /^we need to talk\b/i,
  /^(quick|a) (thought|reminder)\b/i
];

const TIMEFRAME = /\b(in|within|over|across|after|since|during|last|this|per|a|each|every)\s+(\d+\s+)?(day|days|week|weeks|month|months|quarter|quarters|year|years|q[1-4]|h[12]|fy\d*)\b|\b(19|20)\d{2}\b|\bq[1-4]\b|\bytd\b|\bmonthly\b|\bweekly\b|\bannually\b|\byear[- ]over[- ]year\b|\byoy\b|\bmom\b/i;

const BASELINE = /\bfrom\s+[$₹€£]?\d|\bvs\.?\s|\bversus\b|\bcompared (to|with)\b|\bbaseline\b|\bup from\b|\bdown from\b/i;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SUPERLATIVE_RE = new RegExp(
  '(^|[^\\w#])(' + SUPERLATIVES.map(escapeRegex).join('|') + ')(?![\\w])',
  'gi'
);

const RESULT_RE = new RegExp(
  '(^|[^\\w])(' + RESULT_VERBS.map(escapeRegex).join('|') + ')(?![\\w])',
  'gi'
);

// Numbers that read as claims: percentages, money, multipliers, magnitudes,
// and counts followed by a noun. Years and list markers are ignored.
const NUMBER_RE = /(?:[$₹€£]\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|mm|bn|b|million|billion|lakh|crore)?\b)|(?:\b\d[\d,]*(?:\.\d+)?\s?%)|(?:\b\d+(?:\.\d+)?\s?x\b)|(?:\b\d[\d,]*(?:\.\d+)?\s?(?:k|m|mm|bn|million|billion|lakh|crore)\b)|(?:\b\d[\d,]*(?:\.\d+)?\+?\s+(?:[a-z][a-z-]+))/gi;

const NOT_CLAIM_WORDS = new Set([
  'am', 'pm', 'min', 'mins', 'minute', 'minutes', 'sec', 'seconds', 'hour', 'hours',
  'st', 'nd', 'rd', 'th', 'of', 'and', 'or', 'to', 'a', 'an', 'the', 'step', 'steps',
  'tip', 'tips', 'thing', 'things', 'lesson', 'lessons', 'reason', 'reasons', 'way', 'ways',
  'idea', 'ideas', 'rule', 'rules', 'mistake', 'mistakes', 'question', 'questions'
]);

/** Split text into sentences with their start offsets. */
export function splitSentences(text) {
  const out = [];
  const re = /[^.!?\n]+[.!?]*|\n+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (!raw.trim()) continue;
    const lead = raw.length - raw.trimStart().length;
    out.push({ text: raw.trim(), start: m.index + lead });
  }
  return out;
}

function isYear(token) {
  return /^(19|20)\d{2}$/.test(token.trim());
}

/** Return numeric claims found in a string. */
export function findNumbers(text) {
  const found = [];
  NUMBER_RE.lastIndex = 0;
  let m;
  while ((m = NUMBER_RE.exec(text)) !== null) {
    const match = m[0].trim();
    const lead = m[0].length - m[0].trimStart().length;
    const index = m.index + lead;
    const numPart = (match.match(/\d[\d,]*(?:\.\d+)?/) || [''])[0];
    // Plain "N word" form: skip years, list markers and non-claim nouns.
    if (/^\d[\d,]*(?:\.\d+)?\+?\s+[a-z]/i.test(match) && !/%|x\b/i.test(match)) {
      const word = match.split(/\s+/)[1].toLowerCase();
      if (isYear(numPart)) continue;
      if (NOT_CLAIM_WORDS.has(word)) continue;
      const before = text.slice(Math.max(0, index - 1), index);
      if (/[\d.:/]/.test(before)) continue; // part of a date, time or decimal
      const lineStart = text.lastIndexOf('\n', index - 1) + 1;
      if (/^\s*$/.test(text.slice(lineStart, index)) && /^\d+[.)]/.test(text.slice(index))) continue;
      if (Number(numPart.replace(/,/g, '')) < 2) continue;
      found.push({ match, index });
      continue;
    }
    if (isYear(match)) continue;
    found.push({ match, index });
  }
  return found;
}

/** Return superlatives and absolute words found in a string. */
export function findSuperlatives(text) {
  const found = [];
  SUPERLATIVE_RE.lastIndex = 0;
  let m;
  while ((m = SUPERLATIVE_RE.exec(text)) !== null) {
    const index = m.index + m[1].length;
    found.push({ match: m[2], index });
  }
  return found;
}

/** Return result verbs ("grew", "doubled") found in a string. */
export function findResultVerbs(text) {
  const found = [];
  RESULT_RE.lastIndex = 0;
  let m;
  while ((m = RESULT_RE.exec(text)) !== null) {
    found.push({ match: m[2], index: m.index + m[1].length });
  }
  return found;
}

/** True when a sentence carries a visible source marker. */
export function hasSource(sentence) {
  return SOURCE_MARKERS.some((re) => re.test(sentence));
}

/** Check the first line of a post for generic openers. */
export function checkHook(text) {
  const firstLine = (text.split('\n').find((l) => l.trim()) || '').trim();
  const issues = [];
  if (!firstLine) return issues;
  for (const re of VAGUE_HOOKS) {
    if (re.test(firstLine)) {
      issues.push({
        kind: 'vague-hook',
        severity: 'medium',
        quote: firstLine,
        message: 'The opening line is a stock opener. Lead with the specific point, result or question instead.'
      });
      break;
    }
  }
  const words = firstLine.split(/\s+/).length;
  if (words > 25) {
    issues.push({
      kind: 'vague-hook',
      severity: 'low',
      quote: firstLine,
      message: `The opening line is ${words} words. Most of it will be hidden behind "see more". Aim for under 20.`
    });
  }
  return issues;
}

/**
 * Run every rule-based check on a draft.
 * @param {string} text
 * @returns {{issues: Array<{kind:string,severity:string,quote:string,message:string}>, stats: object}}
 */
export function precheck(text) {
  const draft = String(text || '');
  const issues = [];
  const stats = { words: 0, numbers: 0, superlatives: 0, unsourcedClaims: 0 };
  if (!draft.trim()) return { issues, stats };

  stats.words = draft.trim().split(/\s+/).length;
  issues.push(...checkHook(draft));

  for (const s of splitSentences(draft)) {
    const sourced = hasSource(s.text);
    const nums = findNumbers(s.text);
    const sups = findSuperlatives(s.text);
    const results = findResultVerbs(s.text);
    stats.numbers += nums.length;
    stats.superlatives += sups.length;

    if (nums.length && !sourced) {
      stats.unsourcedClaims += 1;
      issues.push({
        kind: 'unsourced-number',
        severity: 'high',
        quote: s.text,
        message: `Number with no source: ${nums.map((n) => `"${n.match}"`).join(', ')}. Add where it comes from, or say it is your own data.`
      });
    }
    if (sups.length && !sourced) {
      stats.unsourcedClaims += 1;
      issues.push({
        kind: 'unsourced-superlative',
        severity: 'medium',
        quote: s.text,
        message: `Absolute or superlative claim: ${sups.map((n) => `"${n.match}"`).join(', ')}. Back it up or soften it.`
      });
    }
    if (results.length && nums.length) {
      if (!TIMEFRAME.test(s.text)) {
        issues.push({
          kind: 'missing-context',
          severity: 'medium',
          quote: s.text,
          message: 'Result with no timeframe. Say over what period it happened.'
        });
      }
      if (/%|\bx\b|\dx\b/i.test(s.text) && !BASELINE.test(s.text)) {
        issues.push({
          kind: 'missing-context',
          severity: 'low',
          quote: s.text,
          message: 'Relative change with no baseline. Say what it grew from.'
        });
      }
    }
  }

  if (stats.words < 30) {
    issues.push({
      kind: 'missing-context',
      severity: 'low',
      quote: '',
      message: `The draft is ${stats.words} words. Readers may not get who this is for or why it matters.`
    });
  }

  return { issues, stats };
}

/** Replace em and en dashes so no output text carries them. */
export function stripDashes(text) {
  return String(text || '')
    .replace(/\s*\u2014\s*/g, ', ')
    .replace(/\u2013/g, '-');
}
