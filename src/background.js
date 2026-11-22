// Service worker: holds a LinkedIn draft in memory for a few seconds while
// the checker window opens, then forgets it. No storage APIs are used.

const pending = new Map();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'open-checker' && typeof msg.text === 'string') {
    const id = crypto.randomUUID();
    pending.set(id, msg.text);
    setTimeout(() => pending.delete(id), 60000);
    chrome.windows.create({
      url: chrome.runtime.getURL(`checker.html?draft=${id}`),
      type: 'popup',
      width: 460,
      height: 760
    });
    return false;
  }
  if (msg && msg.type === 'take-draft') {
    const text = pending.get(msg.id) || '';
    pending.delete(msg.id);
    sendResponse({ text });
    return false;
  }
  return false;
});
