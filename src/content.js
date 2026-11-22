// Adds a "Check draft" button to the LinkedIn post composer.
// It reads the composer text only when the button is clicked and hands it
// to the extension's checker window. Nothing is stored.

const BTN_CLASS = 'klype-draft-check-btn';

function findEditors() {
  return Array.from(
    document.querySelectorAll('div.ql-editor[contenteditable="true"], div[role="textbox"][contenteditable="true"]')
  ).filter((ed) => ed.closest('[role="dialog"], .share-box, .share-creation-state'));
}

function readDraft(editor) {
  // innerText keeps the line breaks the author sees.
  return (editor.innerText || '').replace(/ /g, ' ').trim();
}

function addButton(editor) {
  const host = editor.closest('[role="dialog"]') || editor.parentElement;
  if (!host || host.querySelector('.' + BTN_CLASS)) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = BTN_CLASS;
  btn.textContent = 'Check draft';
  btn.title = 'Klype Draft Check: flag unsourced claims, vague hooks and missing context';
  Object.assign(btn.style, {
    position: 'absolute',
    right: '16px',
    bottom: '72px',
    zIndex: '10000',
    padding: '6px 14px',
    borderRadius: '16px',
    border: '1px solid #0a66c2',
    background: '#ffffff',
    color: '#0a66c2',
    font: '600 14px -apple-system, system-ui, sans-serif',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,.15)'
  });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const text = readDraft(editor);
    if (!text) {
      btn.textContent = 'Write something first';
      setTimeout(() => (btn.textContent = 'Check draft'), 1500);
      return;
    }
    chrome.runtime.sendMessage({ type: 'open-checker', text });
  });
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  host.appendChild(btn);
}

function scan() {
  for (const ed of findEditors()) addButton(ed);
}

new MutationObserver(() => scan()).observe(document.documentElement, { childList: true, subtree: true });
scan();
