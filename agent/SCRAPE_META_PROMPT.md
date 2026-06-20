# Site Scrape → Agent Prompt: Meta-Prompt

A reusable prompt for turning **any website** into the two artifacts the voice/chat
agent needs to navigate that site and answer questions about it:

1. **A site index** — `agent/indices/<host_with_dots_as_underscores>.json` — the
   scraped page content the agent searches and navigates.
2. **A site template** — an entry in `agent/src/site_prompts.py` → `SITE_CONTEXT` —
   the instruction prompt that tells the agent *what this site is and what it offers*.

Hand the meta-prompt below to an agent with web access, give it a seed URL, and it
produces both. The same wiring then routes a site to its artifacts:
`extension/clients.json` (or `web/lib/site-registry.ts`) maps a hostname →
`template` + `sandboxId`; `sandboxId` is sanitised (`. : /` → `_`) to pick
`indices/<sandboxId>.json`, and `template` picks the `SITE_CONTEXT` entry.

---

## Why this exists (the two failure modes it prevents)

The agent has two tools that read the index:

- `get_redirect_url(intent)` → navigates and hands the model
  **`content[:1200]`** of the target page as the spoken summary material.
- `search_site_content(query)` → returns each hit's **`summary` + `content[:600]`**.

**Failure #1 — bad navigation.** If a page the template promises (e.g. "pricing",
"chatbot") has no matching `page_type` or title, `get_redirect_url` returns
`action: "none"` and the agent has to say "that page isn't available." Every
keyword the template suggests MUST resolve to a real page.

**Failure #2 — "what is this site / what are the features?" goes unanswered.**
Naive scrapers put the **navigation menu** at the top of `content`
(e.g. `"Pricing Product ▾ WhatsApp Business API Get FREE..."`). Since the agent is
fed `content[:1200]` / `content[:600]`, it only ever sees menu noise and cannot
describe the product. Fix: **every page's `content` must LEAD with clean prose**
(what the page/site is and offers — nav and footer stripped), and the **template
must carry an explicit OVERVIEW + KEY FEATURES block** the agent can recite without
a tool call.

---

## THE META-PROMPT (copy below this line)

> You are building a knowledge pack for a website voice assistant. Given the seed
> URL **`<SEED_URL>`**, produce TWO artifacts. Ground everything in pages you
> actually fetch — never invent prices, features, pages, or URLs.
>
> ### Step 1 — Crawl (sitemap-first)
> **Always start from the sitemap** — it is the authoritative, complete URL list and
> reveals exact slugs so you never 404 guessing nav links. Fetch `<seed>/sitemap.xml`
> (also try `m.<host>/sitemap.xml` and any `sitemap_index.xml`), collect every `<loc>`,
> then FILTER to the real marketing/product pages and DROP the long tail:
> localized copies (`/pt/`, `/es/`, `/hi/`, …), per-item template/blog-post pages,
> legal/`/tos`/`/privacy`, and `/testing`-style junk. Bucket the survivors by first
> path segment (`/features/*`, `/industries/*`, `/integrations/*`, `/products/*`,
> comparison/`*-vs-*`/`*-alternative`, case studies) so you cover every dropdown
> destination, not just the top nav. Ensure you keep at minimum: **home, the
> product/features hub, pricing, blog, about, contact/demo**. Then fetch each kept
> URL. If there is no sitemap, fall back to crawling the home page's nav/footer links.
> A real site nav has dropdowns — every dropdown item is a page a visitor may ask for,
> so coverage (not just 12–20 pages) is what makes navigation feel complete.
>
> ### Step 2 — Clean each page (this is the critical step)
> For each page extract human-readable text, then **remove boilerplate**: the top
> navigation menu, mega-menu dropdowns, cookie banners, and the footer link farm.
> The remaining text must **begin with the page's real headline + value
> proposition + what it offers**, in prose. If after cleaning the text still starts
> with a list of menu labels, clean again — the first 600 characters decide whether
> the agent can answer.
>
> ### Step 3 — Emit the index JSON
> Write `agent/indices/<HOST>.json` where `<HOST>` is the seed hostname with
> `. : /` replaced by `_` (e.g. `aisensy.com` → `aisensy_com`). Exact schema:
>
> ```json
> {
>   "seed": "<SEED_URL>",
>   "page_count": <int>,
>   "pages": [
>     {
>       "url": "https://...",
>       "title": "Page title (clean, no site-name spam)",
>       "page_type": "home|product|pricing|blog|about|contact",
>       "summary": "1–2 sentence description of THIS page.",
>       "content": "CLEAN prose. Leads with what the page/site is and offers. ~2–3k chars. NO leading nav menu.",
>       "key_links": [{"label": "Pricing", "url": "https://.../pricing"}],
>       "forms": []
>     }
>   ]
> }
> ```
>
> Rules for `page_type`:
> - Use exactly one of `home | product | pricing | blog | about | contact` — these
>   are what `get_redirect_url` and `INTENT_MAPPING` resolve against.
> - There must be **exactly one** `home`, `pricing`, `about`, and `contact`.
> - The features hub and every individual feature/product page use `page_type:
>   "product"`. `get_redirect_url` falls back to a **title** match, so for a feature
>   page to be reachable by name (e.g. "chatbot"), that word MUST appear in its
>   `title`. Title your product pages with their feature keyword in them.
> - Case studies / customer stories use `page_type: "blog"`.
> - The **home page entry is special**: its `summary` AND the start of its
>   `content` must together answer "what is this site and what are its top
>   features/products" on their own.
>
> ### Step 4 — Emit the template (SITE_CONTEXT entry)
> Produce a Python triple-quoted string for `SITE_CONTEXT["<template_key>"]` in
> `agent/src/site_prompts.py`, following this skeleton. Fill every section from the
> scrape; keep it tight (it is prepended to the shared voice rules):
>
> ```
> You are the friendly voice assistant embedded on <Company>'s website (<host>).
> OVERVIEW: <1–2 sentences: what the company/product IS and its core value prop —
>   this is the answer to "what is this site about?", say it from memory.>
> KEY FEATURES / WHAT IT OFFERS: <a compact in-prose list of the main
>   products/features — this is the answer to "what are the features?", say it from
>   memory without a tool call.>
> WHO IT'S FOR / INDUSTRIES: <segments served, if the site states them.>
> PRICING SHAPE: <tiers/model in general terms only; never invent numbers.>
> NAVIGATION: To take the visitor to a page, call get_redirect_url. Use "pricing",
>   "product" (features), "blog", "about", "contact"; you may also pass a specific
>   topic keyword — list ONLY keywords you verified resolve: <kw1>, <kw2>, ...
> For specific details (a feature, an industry, an integration, an FAQ), answer
>   from search_site_content. Do not quote specific prices unless they appear in
>   your indexed content.
> ```
>
> ### Step 5 — Validate before finishing
> 1. Every navigation keyword you put in the template's NAVIGATION line must resolve
>    to a real page via `resolve_redirect` (page_type, then title substring). Drop or
>    rename any that return `action: "none"`. Run the snippet in "Validation" below.
> 2. Open the home entry: do its `summary` + first 300 chars of `content` clearly
>    state what the site is and its top features? If not, re-clean.
> 3. No invented facts. Spot-check a price/feature claim against the live page.

## (end meta-prompt)

---

## Wiring a new site after generation

1. Add the template to `agent/src/site_prompts.py` → `SITE_CONTEXT["<key>"]`.
2. Drop the index at `agent/indices/<host_with_underscores>.json`.
3. Register the host in `extension/clients.json` and/or `web/lib/site-registry.ts`
   with `template: "<key>"` and `sandboxId: "<host>"` (so `sandboxId` sanitises to
   the index filename).
4. Redeploy the LiveKit worker (`cd agent && lk agent deploy`) so the cloud agent
   ships the new index + template; redeploy `web/` if you touched the registry.

## Validation (run from `agent/`)

```python
import json, sys
sys.path.insert(0, "src")
from website_agents import resolve_redirect, resolve_search

pages = json.load(open("indices/<host>.json", encoding="utf-8"))["pages"]
keywords = ["pricing","product","blog","about","contact", ...]  # template's NAV line
for k in keywords:
    print(k, "->", resolve_redirect(k, pages)["action"])   # must be "redirect"
print(resolve_search("what is this site about", pages)[:300])
print(resolve_search("what are the features", pages)[:300])
```

All keywords must print `redirect`; both searches must return real prose (not a
menu, not "No matching content").
```
