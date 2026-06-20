/* Options popup for the Voice Assistant extension. Reads/writes chrome.storage.sync. */
const DEFAULTS = {
  lkApiBase: 'http://localhost:3000',
  lkSandboxId: 'assistant-2473',
  lkAgentName: 'assistant-2473',
  lkAccent: '#16a34a',
  lkWidgetBackground: '',
};

const $ = (id) => document.getElementById(id);

function normalizeHex(v) {
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : '';
}

function load() {
  chrome.storage.sync.get(DEFAULTS, (cfg) => {
    $('apiBase').value = cfg.lkApiBase;
    $('sandboxId').value = cfg.lkSandboxId;
    $('agentName').value = cfg.lkAgentName;
    $('accent').value = cfg.lkAccent;
    $('accentColor').value = normalizeHex(cfg.lkAccent) || '#16a34a';
    $('widgetBackground').value = cfg.lkWidgetBackground;
    $('bgColor').value = normalizeHex(cfg.lkWidgetBackground) || '#ffffff';
  });
}

// Keep the color picker and the text field in sync, both directions.
$('accentColor').addEventListener('input', (e) => ($('accent').value = e.target.value));
$('accent').addEventListener('input', (e) => {
  const h = normalizeHex(e.target.value);
  if (h) $('accentColor').value = h;
});
$('bgColor').addEventListener('input', (e) => ($('widgetBackground').value = e.target.value));
$('widgetBackground').addEventListener('input', (e) => {
  const h = normalizeHex(e.target.value);
  if (h) $('bgColor').value = h;
});

$('save').addEventListener('click', () => {
  const cfg = {
    lkApiBase: $('apiBase').value.trim().replace(/\/$/, '') || DEFAULTS.lkApiBase,
    lkSandboxId: $('sandboxId').value.trim() || DEFAULTS.lkSandboxId,
    lkAgentName: $('agentName').value.trim() || DEFAULTS.lkAgentName,
    lkAccent: $('accent').value.trim() || DEFAULTS.lkAccent,
    lkWidgetBackground: $('widgetBackground').value.trim(),
  };
  chrome.storage.sync.set(cfg, () => {
    $('status').textContent = 'Saved. Reload the page to apply.';
    setTimeout(() => ($('status').textContent = ''), 2500);
  });
});

load();
