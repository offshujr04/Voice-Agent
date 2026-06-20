/**
 * UI actions pushed from the voice agent over the LiveKit data channel.
 *
 * The Python agent (agent/src/agent.py) forwards the structured tool outputs
 * from the openai-agents `triage_agent` on the topic `lk.ui.action`. Each
 * payload is a JSON object with an `action` discriminator. This module decodes
 * a payload and performs the corresponding navigation on the host page.
 */

export const UI_ACTION_TOPIC = 'lk.ui.action';

export type UiAction =
  | { action: 'redirect'; url: string; label?: string }
  | { action: 'history'; direction: 'back' | 'forward' }
  | { action: 'schedule'; url: string; label?: string }
  | { action: 'form_submitted'; message?: string; email?: string }
  | { action: string; [key: string]: unknown };

/** Decode a DataReceived payload into a UiAction, or null if it isn't one. */
export function parseUiAction(payload: Uint8Array): UiAction | null {
  try {
    const text = new TextDecoder().decode(payload);
    const obj = JSON.parse(text);
    if (obj && typeof obj === 'object' && typeof obj.action === 'string') {
      return obj as UiAction;
    }
  } catch {
    // not a UI action payload — ignore
  }
  return null;
}

/**
 * Perform a UI action on the host page.
 *
 * The popup widget is injected directly into the host page (shadow DOM, not an
 * iframe), so `window` here is the host window — navigating it moves the actual
 * site, which is exactly what the visitor asked for by voice.
 */
export function handleUiAction(action: UiAction): void {
  switch (action.action) {
    case 'redirect': {
      const url = (action as { url?: string }).url;
      if (url) {
        // Same behavior as the text widget: send the visitor to the page.
        window.location.href = url;
      }
      break;
    }
    case 'history': {
      const direction = (action as { direction?: string }).direction;
      if (direction === 'back') {
        window.history.back();
      } else if (direction === 'forward') {
        window.history.forward();
      }
      break;
    }
    case 'schedule': {
      const url = (action as { url?: string }).url;
      if (url) {
        // External (e.g. Calendly) — open in a new tab so the call isn't dropped.
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      break;
    }
    // 'form_submitted' / 'error' / 'none' need no page navigation.
    default:
      break;
  }
}
