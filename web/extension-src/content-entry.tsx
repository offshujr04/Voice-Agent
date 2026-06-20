/**
 * Chrome extension content script — injects the LiveKit voice widget on ANY site.
 *
 * Runs in the content-script (isolated) world, so it works even on sites with a
 * strict Content-Security-Policy (e.g. salesforce.com) where a <script>/GTM embed
 * would be blocked. It reads per-install config from chrome.storage (API base,
 * sandbox id, accent + pill background colors) and mounts the same widget used by
 * the web embed into a shadow DOM.
 */
import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { APP_CONFIG_DEFAULTS } from '@/app-config';
import EmbedFixedAgentClient from '@/components/embed-popup/agent-client';
import { getShadowStyles } from '@/lib/styles';
import type { AppConfig } from '@/lib/types';
import globalCss from '@/styles/globals.css';

// chrome.* is provided by the extension runtime; avoid a build-time type dep.
declare const chrome: {
  storage?: { sync?: { get: (defaults: unknown, cb: (items: Record<string, unknown>) => void) => void } };
};

const STORAGE_DEFAULTS = {
  lkApiBase: 'http://localhost:3000',
  lkSandboxId: 'assistant-2473',
  lkAgentName: APP_CONFIG_DEFAULTS.agentName ?? 'assistant-2473',
  lkStartButtonText: APP_CONFIG_DEFAULTS.startButtonText ?? 'Start the demo',
  lkAccent: APP_CONFIG_DEFAULTS.accent ?? '#16a34a',
  lkAccentDark: APP_CONFIG_DEFAULTS.accentDark ?? '#22c55e',
  lkWidgetBackground: '', // empty → keep theme default
  lkWidgetBackgroundDark: '',
};

function readConfig(): Promise<typeof STORAGE_DEFAULTS> {
  return new Promise((resolve) => {
    if (!chrome?.storage?.sync) {
      resolve(STORAGE_DEFAULTS);
      return;
    }
    chrome.storage.sync.get(STORAGE_DEFAULTS, (items) =>
      resolve({ ...STORAGE_DEFAULTS, ...(items as typeof STORAGE_DEFAULTS) })
    );
  });
}

function mount(cfg: typeof STORAGE_DEFAULTS) {
  if (document.getElementById('lk-embed-wrapper')) {
    return; // already injected (SPA re-run guard)
  }

  // Token requests must go to the LiveKit app, not the host site.
  (window as Window & { __lkApiBase?: string }).__lkApiBase = cfg.lkApiBase;

  const appConfig: AppConfig = {
    ...APP_CONFIG_DEFAULTS,
    sandboxId: cfg.lkSandboxId,
    agentName: cfg.lkAgentName,
    startButtonText: cfg.lkStartButtonText,
    accent: cfg.lkAccent,
    accentDark: cfg.lkAccentDark,
    widgetBackground: cfg.lkWidgetBackground || undefined,
    widgetBackgroundDark: cfg.lkWidgetBackgroundDark || undefined,
  };

  const wrapper = document.createElement('div');
  wrapper.id = 'lk-embed-wrapper';
  wrapper.style.cssText =
    'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;';
  document.body.appendChild(wrapper);

  const shadowRoot = wrapper.attachShadow({ mode: 'open' });

  const styleTag = document.createElement('style');
  styleTag.textContent = String(globalCss);
  shadowRoot.appendChild(styleTag);

  const dynamic = getShadowStyles(appConfig);
  if (dynamic) {
    const dynamicTag = document.createElement('style');
    dynamicTag.textContent = dynamic;
    shadowRoot.appendChild(dynamicTag);
  }

  const reactRoot = document.createElement('div');
  shadowRoot.appendChild(reactRoot);
  ReactDOM.createRoot(reactRoot).render(<EmbedFixedAgentClient appConfig={appConfig} />);
}

function start() {
  readConfig()
    .then(mount)
    .catch((err) => console.error('LiveKit extension: failed to mount widget', err));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
