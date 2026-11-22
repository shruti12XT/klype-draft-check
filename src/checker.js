// UI for the popup and for the checker window opened from LinkedIn.
import { precheck } from './rules.js';
import { runModelCheck, prepareOnDevice, onDeviceStatus, configIsFilled } from './model.js';

const $ = (id) => document.getElementById(id);
const draftEl = $('draft');
const checkBtn = $('check');
const modeEl = $('mode');
const statusEl = $('status');
const deviceEl = $('device');
const rulesEl = $('rules');
const aiEl = $('ai');
const rewriteWrap = $('rewrite-wrap');
const rewriteEl = $('rewrite');
const copyBtn = $('copy');
const badgeEl = $('badge');

const KIND_LABEL = {
  'unsourced-number': 'Number without a source',
  'unsourced-superlative': 'Superlative without a source',
  'vague-hook': 'Vague hook',
  'missing-context': 'Missing context'
};

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function renderRules(result) {
  rulesEl.replaceChildren();
  const { issues, stats } = result;
  const head = el('p', 'meta', `${stats.words} words, ${stats.numbers} numbers, ${stats.superlatives} superlatives, ${stats.unsourcedClaims} unsourced claims`);
  rulesEl.append(head);
  if (!issues.length) {
    rulesEl.append(el('p', 'ok', 'No rule-based flags.'));
    return;
  }
  const list = el('ul', 'issues');
  for (const i of issues) {
    const li = el('li', `issue sev-${i.severity}`);
    li.append(el('strong', '', KIND_LABEL[i.kind] || i.kind));
    li.append(el('span', '', ' ' + i.message));
    if (i.quote) li.append(el('blockquote', '', i.quote));
    list.append(li);
  }
  rulesEl.append(list);
}

function renderAi(out) {
  aiEl.replaceChildren();
  badgeEl.hidden = false;
  badgeEl.className = `badge ${out.source === 'on-device' ? 'badge-device' : 'badge-cloud'}`;
  badgeEl.textContent = out.source === 'on-device'
    ? 'Ran on-device: Gemini Nano in Chrome'
    : 'Ran in the cloud: Gemini via Firebase AI Logic';
  if (!out.parsed) aiEl.append(el('p', 'meta', 'The model did not return structured issues. Its full answer is shown as the rewrite.'));
  if (out.issues.length) {
    const list = el('ul', 'issues');
    for (const i of out.issues) {
      const li = el('li', 'issue');
      if (i.quote) li.append(el('blockquote', '', i.quote));
      li.append(el('p', '', i.problem));
      li.append(el('p', 'fix', 'Fix: ' + i.fix));
      list.append(li);
    }
    aiEl.append(list);
  } else if (out.parsed) {
    aiEl.append(el('p', 'ok', 'The model found nothing more to flag.'));
  }
  rewriteEl.value = out.rewrite;
  rewriteWrap.hidden = !out.rewrite;
}

async function refreshDeviceStatus() {
  const s = await onDeviceStatus();
  const text = {
    available: 'Gemini Nano is ready in this browser. Checks run on your device.',
    downloadable: 'Gemini Nano can be downloaded. The first check starts the download and uses the cloud until it finishes.',
    downloading: 'Gemini Nano is downloading. Checks use the cloud until it finishes.',
    unavailable: 'Gemini Nano is not available on this device. Checks use the cloud.',
    missing: 'This Chrome has no built-in Prompt API. Checks use the cloud.'
  }[s] || `On-device status: ${s}`;
  deviceEl.textContent = text + (configIsFilled() ? '' : ' Cloud fallback is off until firebase-config.js is filled.');
}

async function check() {
  const draft = draftEl.value.trim();
  if (!draft) {
    statusEl.textContent = 'Paste or write a draft first.';
    return;
  }
  const modeKey = modeEl.value;
  const pre = precheck(draft);
  renderRules(pre);
  aiEl.replaceChildren();
  rewriteWrap.hidden = true;
  badgeEl.hidden = true;
  checkBtn.disabled = true;
  statusEl.textContent = 'Checking with the model...';
  try {
    // Must run inside the click handler: the Prompt API needs a user gesture to download.
    prepareOnDevice(modeKey, (p) => {
      deviceEl.textContent = `Downloading Gemini Nano: ${Math.round(p * 100)}%`;
    });
    const out = await runModelCheck(draft, pre.issues, modeKey);
    renderAi(out);
    statusEl.textContent = '';
  } catch (e) {
    statusEl.textContent = `Model check failed: ${e && e.message ? e.message : e}. The rule-based flags above still apply.`;
  } finally {
    checkBtn.disabled = false;
  }
}

checkBtn.addEventListener('click', check);
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(rewriteEl.value);
    copyBtn.textContent = 'Copied';
  } catch {
    rewriteEl.select();
    copyBtn.textContent = 'Press Ctrl+C to copy';
  }
  setTimeout(() => (copyBtn.textContent = 'Copy rewrite'), 1800);
});

// When opened from the LinkedIn button, fetch the draft held in memory by the service worker.
const params = new URLSearchParams(location.search);
if (params.get('draft') && globalThis.chrome && chrome.runtime) {
  document.body.classList.add('window');
  chrome.runtime.sendMessage({ type: 'take-draft', id: params.get('draft') }, (res) => {
    if (res && res.text) {
      draftEl.value = res.text;
      renderRules(precheck(res.text));
      statusEl.textContent = 'Draft loaded from LinkedIn. Click "Check draft" to run the model.';
    }
  });
}

refreshDeviceStatus();
