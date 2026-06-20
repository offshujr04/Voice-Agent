import type { AppConfig } from './lib/types';

export const APP_CONFIG_DEFAULTS: AppConfig = {
  // For the standalone bundle these come from data- attributes / site-registry.
  // For the hosted dev/demo page they fall back to these env vars (unset in prod),
  // so local can preview a specific client, e.g. NEXT_PUBLIC_DEFAULT_TEMPLATE=aisensy.
  sandboxId: process.env.NEXT_PUBLIC_DEFAULT_SANDBOX_ID,
  agentName: 'assistant-2473',
  template: process.env.NEXT_PUBLIC_DEFAULT_TEMPLATE,
  supportsChatInput: process.env.NEXT_PUBLIC_SUPPORTS_CHAT_INPUT === 'true',
  supportsVideoInput: false,
  supportsScreenShare: false,
  isPreConnectBufferEnabled: true,
  startButtonText: 'Start the demo',
  companyName: 'Assistant',
  accent: '#16a34a',
  accentDark: '#22c55e',
  logo: 'https://assistant-2473-web.vercel.app/lk-logo.svg',
  logoDark: 'https://assistant-2473-web.vercel.app/lk-logo-dark.svg',
};
