"""Rebuild agent/indices/aisensy_com.json from the live sitemap.

Sitemap-driven: pulls aisensy.com's sitemap(s), keeps the real marketing/product
pages (drops localized /pt/ /es/, template-message long-tail, legal, test pages),
then fetches each and strips <nav>/<header>/<footer>/<script>/<style> so content
LEADS with prose. Pricing + About get verified hardcoded blocks prepended so those
two critical answers never depend on a messy scrape.

    uv run python _scrape_aisensy.py
"""

import json
import re
from html.parser import HTMLParser

import httpx

SITEMAPS = ["https://m.aisensy.com/sitemap.xml", "https://aisensy.com/sitemap.xml"]
SKIP_TAGS = {"nav", "header", "footer", "script", "style", "svg", "noscript", "form"}
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; AiSensyScrape/1.0)"}


# ---- HTML -> clean text ------------------------------------------------------
class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.title = ""
        self.meta_desc = ""
        self._skip = 0
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in SKIP_TAGS:
            self._skip += 1
        elif tag == "title":
            self._in_title = True
        elif tag == "meta":
            d = dict(attrs)
            if d.get("name") == "description" and d.get("content"):
                self.meta_desc = d["content"].strip()

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS and self._skip:
            self._skip -= 1
        elif tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif self._skip == 0:
            t = data.strip()
            if t:
                self.parts.append(t)


def clean_text(parts):
    text = "\n".join(parts)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    for marker in ("© 20", "Made with", "All rights reserved"):
        i = text.find(marker)
        if i > 400:
            text = text[:i]
    return text.strip()


# ---- title prettifier --------------------------------------------------------
_CAPS = {
    "ai": "AI",
    "api": "API",
    "crm": "CRM",
    "hr": "HR",
    "qr": "QR",
    "d2c": "D2C",
    "it": "IT",
    "ui": "UI",
    "ux": "UX",
    "ads": "Ads",
}


def readable(slug: str) -> str:
    words = slug.split("-")
    out = []
    for w in words:
        if w in _CAPS:
            out.append(_CAPS[w])
        elif w.startswith("whatsapp"):
            out.append("WhatsApp" + w[len("whatsapp") :])
        else:
            out.append(w.capitalize())
    return " ".join(out)


# Keyword-bearing title overrides so navigation intents resolve via title substring.
TITLE_OVERRIDE = {
    "https://aisensy.com": "AiSensy - Smartest WhatsApp Marketing & Engagement Platform",
    "https://aisensy.com/features": "AiSensy Platform Features & Product Overview (WhatsApp Business API)",
    "https://aisensy.com/whatsapp-business-api": "WhatsApp Business API - Get it Free (Green Tick / Blue Tick)",
    "https://aisensy.com/products/whatsapp-blue-tick": "WhatsApp Blue Tick / Green Tick Verification",
    "https://aisensy.com/whatsapp-catalogues": "WhatsApp Catalogues / Catalog - sell on WhatsApp",
    "https://aisensy.com/tutorials": "Tutorials, Resources & Help Center",
    "https://aisensy.com/whatsapp-template-message-library": "WhatsApp Template Message Library / Templates",
    "https://aisensy.com/partner": "Become a Partner - AiSensy Partner Program",
    "https://aisensy.com/enterprise": "AiSensy Enterprise - WhatsApp for large teams",
    "https://aisensy.com/contact-us": "Contact AiSensy / Book a Demo / Support",
    "https://aisensy.com/about-us": "About AiSensy - Company, Founder, Vision & Mission",
    "https://m.aisensy.com/blog": "The WhatsApp Marketing Blog - AiSensy",
    "https://aisensy.com/case-studies": "WhatsApp Marketing Case Studies & Customer Stories",
    "https://www.app.aisensy.com/signup": "Signup / Sign Up / Get Started Free with AiSensy",
    "https://aisensy.com/integrations": "2000+ WhatsApp Business API Integrations",
}

SUMMARY_OVERRIDE = {
    "https://aisensy.com": "AiSensy is the official WhatsApp Business API platform trusted by 100,000+ businesses for broadcasts, chatbots, AI agents, click-to-WhatsApp ads, payments and shared team inbox.",
    "https://aisensy.com/about-us": "About AiSensy — a Meta Business Partner and WhatsApp Business API platform used by 100,000+ businesses across 68+ countries; company vision, mission and stats.",
    "https://m.aisensy.com/blog": "Guides and articles on WhatsApp marketing, automation and the WhatsApp Business API.",
}

PRICING_BLOCK = (
    "AiSensy WhatsApp Business API pricing (India). Plans, all with unlimited team "
    "members: Free Forever (₹0); Basic ₹1,500/month; Pro ₹3,200/month (most popular); "
    "Premium ₹9,100/month; Unlimited ₹45,000/month; Enterprise is custom-priced. "
    "There is NO setup fee and AiSensy does not charge to procure the WhatsApp Business "
    "API. Meta's per-message template charges are billed separately on top: Marketing "
    "₹1.09, Utility and Authentication ₹0.145, and Service messages are free within the "
    "24-hour customer service window. Pro adds over Basic: campaign scheduling, click "
    "tracking, budget & analytics, and project APIs. AI Chatbots & AI Agents are add-ons "
    "(Basic ₹2,500/month, Pro+AI ₹3,500/month). A 14-day free trial is available. "
)

ABOUT_BLOCK = (
    "AiSensy is the smartest WhatsApp Marketing & Engagement platform, built on the "
    "official WhatsApp Business API and a Meta Business Partner. It is one complete "
    "platform for everything WhatsApp: acquire customers with Click-to-WhatsApp ads, "
    "qualify leads with forms, drive revenue with broadcasts and catalogs, collect "
    "payments natively in WhatsApp, and support customers with live chat and AI "
    "chatbots. By the numbers: trusted by 100,000+ businesses across 68+ countries, a "
    "100+ person team, 1.5 billion+ messages sent, and 200 crore+ in revenue generated "
    "for customers, with 200+ partners. Recognised by Meta as Emerging Partner of the "
    "Year 2023 and CTWA Partner of the Year 2024. "
    "Vision: To empower businesses to grow their revenues via seamless communication "
    "with their users. Mission: Becoming market leaders by empowering 5 million+ "
    "businesses via AiSensy. AiSensy Communications Private Limited is based in India "
    "and is actively hiring across multiple roles. Note: the website does not publish "
    "individual founder names. "
)

PREPEND = {
    "https://aisensy.com/pricing": PRICING_BLOCK,
    "https://aisensy.com/about-us": ABOUT_BLOCK,
}

# Extra pages not in the marketing sitemap that we still want reachable.
EXTRA = ["https://www.app.aisensy.com/signup", "https://m.aisensy.com/blog"]

# A curated set of named case studies (the hub + notable customers) so
# "do you have a customer in X" answers are grounded.
CASE_STUDIES_KEEP = {
    "physicswallah",
    "indiamart",
    "adani-realty",
    "cosco",
    "delhi-transport-corporation",
    "skullcandy",
    "thyrocare",
    "nmims",
    "yakult",
    "homelane",
}


# ---- selection ---------------------------------------------------------------
def page_type_for(path: str) -> str:
    if path in ("", "/"):
        return "home"
    if path == "/pricing":
        return "pricing"
    if path == "/about-us":
        return "about"
    if path == "/contact-us":
        return "contact"
    if path.startswith("/case-studies") or "/blog" in path:
        return "blog"
    if re.search(r"(vs|alternative)", path):
        return "comparison"
    return "product"


def select(locs: set[str]) -> list[str]:
    keep = []
    for u in sorted(locs):
        if "m.aisensy.com" in u:
            continue  # blog long-tail; we add the hub separately
        if not u.startswith("https://aisensy.com"):
            continue
        path = u.replace("https://aisensy.com", "")
        # drop localized + noise
        if re.search(r"/(pt|es|fr|de|ar|id|hi)(/|$)", path):
            continue
        if path in ("/es", "/pt", "/hi"):
            continue
        if path != "/whatsapp-template-message-library" and (
            "whatsapp-marketing-template" in path or "whatsapp-template-" in path
        ):
            continue
        if "whatsapp-marketing-test" in path or "whatsapp-chatbot-template" in path:
            continue
        if path in ("/gleap",):
            continue
        if path.startswith("/tutorials/"):
            continue  # keep /tutorials hub only
        if path in (
            "/testing",
            "/testing2",
            "/thank-you",
            "/privacy-policy",
            "/refund-policy",
            "/tos",
            "/government-contact-form",
            "/partner-request-callback",
            "/ai-chatbot-request-callback",
            "/pricing/usd",
            "/planos-precos",
            "/planos-e-precos",
            "/about-evolve",
            "/ai-showcase-evolve",
            "/evolve-delhi",
            "/demo-english",
            "/demo-hindi",
        ):
            continue
        if path.startswith("/case-studies/"):
            slug = path.split("/")[-1]
            if slug not in CASE_STUDIES_KEEP:
                continue
        keep.append(u)
    return keep


def main():
    locs = set()
    with httpx.Client(follow_redirects=True, timeout=25, headers=HEADERS) as client:
        for sm in SITEMAPS:
            try:
                r = client.get(sm)
                locs |= set(re.findall(r"<loc>(.*?)</loc>", r.text))
            except Exception as e:
                print("sitemap fail", sm, e)

        urls = select(locs) + EXTRA
        print(f"selected {len(urls)} urls\n")

        out_pages = []
        for url in urls:
            path = url.replace("https://aisensy.com", "").replace(
                "https://m.aisensy.com", ""
            )
            ptype = page_type_for(path)
            title = TITLE_OVERRIDE.get(url)
            summary = SUMMARY_OVERRIDE.get(url, "")
            content = ""
            try:
                r = client.get(url)
                if r.status_code == 200:
                    ex = TextExtractor()
                    ex.feed(r.text)
                    content = clean_text(ex.parts)
                    if not title:
                        slug = path.strip("/").split("/")[-1] or "home"
                        title = readable(slug)
                    if not summary:
                        summary = ex.meta_desc or content[:180]
                else:
                    print(f"  {r.status_code} {url}")
            except Exception as e:
                print(f"  FAIL {url}: {e}")
            if not title:
                slug = path.strip("/").split("/")[-1] or "home"
                title = readable(slug)
            if url in PREPEND:
                content = PREPEND[url] + "\n" + content
            if not summary:
                summary = title
            if not content:
                content = summary
            out_pages.append(
                {
                    "url": url,
                    "title": title,
                    "page_type": ptype,
                    "summary": summary,
                    "content": content[:3000],
                    "key_links": [],
                    "forms": [],
                }
            )
            print(f"  ok {ptype:10} {len(content):5}  {title[:55]}")

    index = {
        "seed": "https://aisensy.com",
        "page_count": len(out_pages),
        "pages": out_pages,
    }
    with open("indices/aisensy_com.json", "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, indent=2)
    print(f"\nWrote indices/aisensy_com.json with {len(out_pages)} pages")


if __name__ == "__main__":
    main()
