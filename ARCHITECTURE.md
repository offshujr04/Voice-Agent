# Voice-Agent — Architecture & File Structure

## What this project is

A **voice AI assistant** that website owners embed with a single `<script>` tag. A user
clicks a floating pill at the bottom of the page, talks to it, and an AI agent answers by
voice in real time. It's built on **LiveKit** (real-time audio infrastructure) and split into
two independently-deployed halves:

```
Voice-Agent/
├── agent/   →  the brain (Python)   → deploys to LiveKit Cloud
└── web/     →  the widget (Next.js) → deploys to Vercel
```

---

## The big picture: how a conversation happens

```
 Host website                  Vercel (web/)              LiveKit Cloud
┌──────────────┐    1. load   ┌──────────────┐
│ <script       │ ───────────> │ embed.js     │  tiny ~1KB loader
│  embed.js>    │              │ embed-popup.js│ full React widget (webpack bundle)
└──────┬───────┘              └──────┬───────┘
       │ user clicks pill            │
       │ 2. POST /api/connection-details (mints a JWT token + room)
       │ <───────────────────────────┘
       │ 3. room.connect(serverUrl, token)
       └──────────── WebRTC audio ──────────────────> ┌─────────────────┐
                                                       │ AgentServer     │
                                                       │ (agent.py)      │
                                                       │ STT→LLM→TTS loop│
                       <──── agent's voice audio ───── └─────────────────┘
```

1. The host page loads `embed.js`, which lazily injects `embed-popup.js` (the real widget).
2. When the user clicks, the widget asks `web`'s API for **connection details** — a
   short-lived JWT and a freshly-named room.
3. The widget joins that LiveKit room over WebRTC, publishing the user's microphone.
4. LiveKit Cloud dispatches the **Python agent** into the same room. The agent runs the
   speech→thinking→speech loop and streams its voice back.

---

## `agent/` — the voice agent (Python)

The entire brain is **one file**: `agent/src/agent.py` (~85 lines).

**`DefaultAgent`** — defines the assistant's personality via a system prompt: a website
helper that answers in 1–2 plain-text sentences, navigates pages, and says "I could not find
that here" when stuck. `on_enter()` makes it greet the user immediately on connect.

**`entrypoint()`** — wires up the **voice pipeline** (`AgentSession`), which is the heart of it:

| Stage              | Model                      | Role                                      |
|--------------------|----------------------------|-------------------------------------------|
| **STT**            | `deepgram/nova-3`          | speech → text                             |
| **LLM**            | `openai/gpt-4.1-nano`      | text → response                           |
| **TTS**            | `cartesia/sonic-3`         | response → speech                         |
| **VAD**            | `silero`                   | voice activity detection                  |
| **Turn detection** | `MultilingualModel`        | when the user has finished their turn     |
| **Noise cancel**   | `ai_coustics` (QUAIL_VF_S) | clean up mic input                        |

All models are accessed through **LiveKit Inference** (`inference.STT/LLM/TTS`) rather than
direct provider SDKs. `preemptive_generation=True` starts generating before the user fully
stops, for lower latency. `prewarm()` loads the VAD model once per worker process for speed.
`@server.rtc_session(agent_name="assistant-2473")` registers it under a name — that name is
the link to the web side.

**Supporting files:** `pyproject.toml` (deps, managed by `uv`), `Dockerfile` + `livekit.toml`
(deployment to LiveKit Cloud), `.env.local` (the `LIVEKIT_*` secrets), and
`CLAUDE.md`/`AGENTS.md`/`.claude/skills/` for AI coding-assistant guidance.

---

## `web/` — the embeddable widget (Next.js)

This produces two things: the **widget bundle** users embed, and a **token-minting API**.

### The embed delivery chain
- **`public/embed.js`** — the tiny loader clients paste. Guards against double-loading, reads
  `data-lk-sandbox-id`, waits for the page to be idle, then injects the real bundle. Keeps the
  host page fast.
- **`webpack.config.js`** — separately bundles
  `components/embed-popup/standalone-bundle-root.tsx` into **`public/embed-popup.js`** (built
  via `pnpm build-embed-popup-script`). This is a *separate* build from Next.js because it must
  run standalone on any third-party site.
- **`standalone-bundle-root.tsx`** — the bundle's entry point. It creates a `position:fixed`
  wrapper pinned to max z-index, attaches a **Shadow DOM** root (so the widget's CSS can't leak
  into — or be broken by — the host site), injects styles, fetches config, and mounts the React
  app.

### The widget UI (`components/embed-popup/`)
- **`agent-client.tsx`** — the controller. Holds the LiveKit `Room`, manages open/closed state,
  connects the mic + room on open, disconnects on close, handles errors. Wraps everything in
  `RoomContext`.
- **`trigger.tsx`** — the closed-state launcher pill ("Start the demo" + orb).
- **`popup-view.tsx`** — the open-state pill: shows agent state (Listening/Thinking/Speaking),
  mic mute toggle, end-call and minimize buttons. Times out with an error if the agent never
  joins.
- **`agent-orb.tsx`, `audio-visualizer.tsx`, `border-line.tsx`** — the visuals: the animated
  orb, audio levels, and the traveling green border light.
- **`error-message.tsx`, `microphone-toggle.tsx`, `transcript.tsx`, `action-bar.tsx`** —
  supporting UI.

### The token API
- **`app/api/connection-details/route.ts`** — the **only backend logic**. On POST, it mints a
  15-minute LiveKit `AccessToken`, generates a random room + participant name, and embeds the
  `agentName` in the room config (so LiveKit dispatches the right agent). Wide-open CORS because
  it's called from third-party sites. This is where the `LIVEKIT_API_SECRET` lives — never
  exposed to the browser.
- **`hooks/use-connection-details.ts`** — client side of that: fetches tokens, checks JWT
  expiry, refreshes when stale.

### Two embed flavors
There are actually **two** widget implementations:
- **`embed-popup/`** — the floating pill injected via `<script>` (the main product, what
  `embed.js` loads).
- **`embed-iframe/`** — an alternative rendered at the `/embed` route (`app/(iframe)/`), meant
  to be dropped into an `<iframe>`. Same idea, different isolation strategy.

### App routes & config
- **`app/(app)/page.tsx`** — the demo/welcome landing page.
- **`app/test/popup/page.tsx`** — a minimal page to test the *bundled* `embed-popup.js` against
  bare styling (debugging the shadow-DOM CSS).
- **`app-config.ts`** — branding/feature defaults: `agentName: 'assistant-2473'`, green accent,
  no chat/video/screenshare, greeting text. `lib/env.ts` can override these from a remote
  sandbox config endpoint per `sandboxId`.

---

## Key things to know

- **The two halves are linked by one string:** `agent_name = "assistant-2473"`. The token API
  embeds it; LiveKit uses it to dispatch the right agent. It appears in `agent.py`,
  `app-config.ts`, and `embed.js`.
- **Secrets** (`LIVEKIT_URL/API_KEY/API_SECRET`) live only in `.env.local` files (gitignored)
  on both sides and in the Vercel/LiveKit dashboards.
- **The widget bundle is built separately** from the Next.js app — if you change popup code, you
  must re-run `pnpm build-embed-popup-script` or the embed won't update.
- **Shadow DOM** is the isolation mechanism that lets this safely run on any website.

---

## Embed snippet

```html
<script
  src="https://<your-app>.vercel.app/embed.js"
  data-lk-sandbox-id="assistant-2473"
  async
></script>
```
