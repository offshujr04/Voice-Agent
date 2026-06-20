# Voice Assistant — Chrome extension (demo)

Injects the LiveKit voice widget on **any** website — including ones with a strict
Content-Security-Policy (e.g. `salesforce.com`) where a `<script>` / GTM embed is
blocked. The widget runs as a content script, so the page's CSP doesn't apply.

This is for **demos** (you install it in your own browser). It is not how you ship
the widget to a site's visitors — for that, use the `<script>` embed in `web/`.

## Build

```bash
cd web
pnpm install
pnpm build-extension          # outputs extension/content.js
```

`manifest.json`, `popup.html`, and `popup.js` are committed; only `content.js` is
generated.

## Load it in Chrome

1. Go to `chrome://extensions`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/` folder.
4. (Optional) Pin the extension so you can open its settings popup.

## Configure (per install / per client)

Click the extension icon to open settings:

- **LiveKit app URL** — where the token API + bundle live. For local dev use
  `http://localhost:3000`; for a deploy use the Vercel URL.
- **Sandbox ID** / **Agent name** — defaults to `assistant-2473`.
- **Accent color** — the orb / moving border color.
- **Pill background** — the widget background color (blank = theme default).

Save, then **reload the page** to apply.

## Demo on salesforce.com

1. Make sure the backend is running:
   - `agent/`: `uv run python src/agent.py dev` (the voice brain)
   - `web/`: `pnpm dev` (serves the token API at the LiveKit app URL you set)
2. Open `https://www.salesforce.com`.
3. The pill appears bottom-center. Click it, allow the microphone, and talk.
4. Ask it to "go to pricing" etc. — it navigates Salesforce's own pages, and the
   call resumes on the new page.

> Note: redirect targets come from the agent's `site_index.json`. To demo
> navigation on Salesforce specifically, re-ingest that site (`agent/ingest.py`)
> or set `SITE_TEMPLATE=salesforce` so the agent's page intents match.

## Notes / limits

- Microphone permission is per-site; Chrome will prompt on first use per origin.
- The call uses a content-script media session. On a full page navigation the
  widget re-injects and resumes (sessionStorage). For an unbroken call across
  navigations, a future version can move the session into an offscreen document.
