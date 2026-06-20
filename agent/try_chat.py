"""Quick local REPL to test a site's agent brain WITHOUT LiveKit or the web app.

Loads the exact same per-site prompt template + page index the voice worker uses
(make_triage_agent + load_pages_for), then lets you chat in the terminal. Use it to
iterate on prompts/indices fast; it exercises the real openai-agents tools, so you
also see navigation actions (redirect/history/etc.) as they fire.

Needs OPENAI_API_KEY in agent/.env.local (already there for the worker).

    uv run python try_chat.py                      # default template + index
    uv run python try_chat.py aisensy aisensy.com  # template=aisensy, index=aisensy_com.json
    uv run python try_chat.py salesforce salesforce.com

Type a question and press enter. Ctrl-C or 'exit' to quit.
"""
import asyncio
import io
import os
import sys

sys.path.insert(0, "src")
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Load OPENAI_API_KEY (and friends) from .env.local the same way agent.py does.
for line in open(".env.local", encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

from agents import Runner  # noqa: E402
import website_agents as wa  # noqa: E402


async def main():
    template = sys.argv[1] if len(sys.argv) > 1 else None
    site_id = sys.argv[2] if len(sys.argv) > 2 else None

    pages = wa.load_pages_for(site_id)
    agent = wa.make_triage_agent(template)
    wa.current_site_pages.set(pages)

    print(f"template={template or 'default'}  site_id={site_id or 'default'}  pages={len(pages)}")
    print("Type a message (or 'exit'):\n")

    history: list = []
    while True:
        try:
            q = input("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not q or q.lower() in ("exit", "quit"):
            break
        history.append({"role": "user", "content": q})
        result = await Runner.run(agent, input=history)
        history = result.to_input_list()
        # surface any UI actions the tools produced this turn
        for it in result.new_items:
            out = getattr(it, "output", None)
            if isinstance(out, dict) and out.get("action") not in (None, "none"):
                print(f"  [action: {out.get('action')} -> {out.get('url', out.get('direction', ''))}]")
        print("bot>", str(result.final_output).encode("ascii", "replace").decode(), "\n")


if __name__ == "__main__":
    asyncio.run(main())
