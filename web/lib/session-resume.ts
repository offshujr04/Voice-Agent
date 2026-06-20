/**
 * Seamless voice-session resume across host-page navigations.
 *
 * The widget is injected into the host page, so a redirect (a real page load)
 * destroys it and would drop the live call. To keep "the agent continues to live
 * and chat", we stash the active connection details in sessionStorage right
 * before navigating, then — on the next page — reconnect to the SAME LiveKit
 * room. The agent stays in that room (it runs with close_on_disconnect=False),
 * so the conversation, including its memory, continues.
 *
 * sessionStorage is per-origin and survives same-origin navigations, which is
 * exactly the scope we want (cross-origin redirects open a new tab instead).
 */
import type { ConnectionDetails } from '@/app/api/connection-details/route';

const RESUME_KEY = 'lk.voice.resume';
// The stash is only valid for a brief navigation hop. Longer than a page load,
// short enough that a stale entry never silently auto-opens the widget later.
const MAX_AGE_MS = 60_000;

/** Stash the active connection so the next page can reconnect to the same room. */
export function saveResumeSession(details: ConnectionDetails): void {
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ details, ts: Date.now() }));
  } catch {
    // sessionStorage unavailable (private mode, etc.) — degrade to a normal reconnect.
  }
}

/** Read and CONSUME a fresh resume stash, or null if none/stale. One-shot. */
export function takeResumeSession(): ConnectionDetails | null {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RESUME_KEY); // consume so it only resumes once
    const parsed = JSON.parse(raw);
    if (typeof parsed?.ts !== 'number' || Date.now() - parsed.ts > MAX_AGE_MS) {
      return null;
    }
    const d = parsed.details;
    if (d && d.serverUrl && d.participantToken) {
      return d as ConnectionDetails;
    }
  } catch {
    // ignore malformed stash
  }
  return null;
}

/** Actions that navigate the page and therefore need a resume stash first. */
export function isNavigatingAction(action: string): boolean {
  return action === 'redirect' || action === 'history';
}
