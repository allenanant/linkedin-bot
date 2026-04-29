"""Scrape comments from a LinkedIn post via browser-harness.

Args (env LI_SCRAPE_ARGS_PATH points to JSON file):
  {
    "activityId": "7455224531927027713",
    "maxExpand": 20    // optional: cap on "Show more comments" clicks
  }

Result (overwrites the same JSON file):
  {
    "ok": true,
    "activityId": "...",
    "url": "https://...",
    "count": 7,
    "comments": [
      {
        "commentUrn": "urn:li:comment:(...)",
        "profileUrl": "https://www.linkedin.com/in/foo-bar/",
        "name": "Foo Bar",
        "text": "comment body..."
      }
    ]
  }
  {"ok": false, "error": "...", "screenshotPath": "..."}

Notes:
- Navigates to /feed/update/urn:li:activity:<id>/ which renders the post + comment section.
- Clicks "Load more comments" / "View previous comments" / "Show more" until no more buttons surface (cap maxExpand).
- Selectors are defensive — LinkedIn restructures DOM frequently. Primary strategy: data-id^="urn:li:comment:". Fallback: article.comments-comment-* class match.
- Excludes Allen's own comments (filter by profile URL = /in/allen-anant-thomas/).
"""
import json, os, sys, time


def main():
    args_path = os.environ.get("LI_SCRAPE_ARGS_PATH")
    if not args_path or not os.path.exists(args_path):
        print(json.dumps({"ok": False, "error": f"args file missing: {args_path}"}))
        return 1

    with open(args_path) as f:
        args = json.load(f)

    activity_id = (args.get("activityId") or "").strip()
    max_expand = int(args.get("maxExpand") or 20)

    def fail(msg, shot=None):
        out = {"ok": False, "error": msg}
        if shot:
            out["screenshotPath"] = shot
        with open(args_path, "w") as f:
            json.dump(out, f)
        print(json.dumps(out))
        sys.exit(1)

    if not activity_id:
        fail("missing activityId")

    url = f"https://www.linkedin.com/feed/update/urn:li:activity:{activity_id}/"

    # Switch to or open a /feed tab so navigation is clean
    tabs = list_tabs(include_chrome=False)
    feed = [t for t in tabs if "linkedin.com" in t["url"]]
    if feed:
        switch_tab(feed[0]["targetId"])
    else:
        new_tab("https://www.linkedin.com/feed/")
        wait_for_load()
        time.sleep(3)

    cdp("Emulation.setDeviceMetricsOverride", width=1440, height=2200, deviceScaleFactor=1, mobile=False)
    time.sleep(0.5)

    press_key("Escape"); time.sleep(0.2)
    goto(url)
    wait_for_load()
    time.sleep(5)

    # Some posts redirect or fail to render — sanity check
    info = page_info()
    final_url = info.get("url", "")
    if "feed/update" not in final_url and "linkedin.com" not in final_url:
        screenshot("/tmp/li-scrape-bad-url.png", full=False)
        fail(f"unexpected URL after goto: {final_url}", "/tmp/li-scrape-bad-url.png")

    # Scroll into the comments region. The post text is at the top; comments live below.
    js("""window.scrollTo(0, Math.max(400, document.body.scrollHeight * 0.4))""")
    time.sleep(2)

    # Click "Load more comments" / "View previous comments" / "Show more" until exhausted.
    expand_count = 0
    for _ in range(max_expand):
        btn = js("""
(() => {
  const txts = ["load more comments", "view more comments", "view previous comments",
                "show more comments", "show more replies", "load previous"];
  function find(root) {
    if (!root || !root.querySelectorAll) return null;
    for (const el of root.querySelectorAll('button, [role="button"]')) {
      const t = (el.textContent || "").trim().toLowerCase();
      const lbl = (el.getAttribute('aria-label') || "").toLowerCase();
      for (const needle of txts) {
        if ((t.includes(needle) || lbl.includes(needle)) && el.offsetParent !== null && !el.disabled) {
          el.scrollIntoView({block: "center"});
          const r = el.getBoundingClientRect();
          return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)};
        }
      }
    }
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) {
        const f = find(el.shadowRoot);
        if (f) return f;
      }
    }
    return null;
  }
  return find(document);
})()
""")
        if not btn:
            break
        click(btn["x"], btn["y"])
        expand_count += 1
        time.sleep(2)

    # Extract comments. Primary: data-id^="urn:li:comment:". Fallback: article elements with
    # classnames containing "comment". Both runs accumulate, deduped at the end by commentUrn.
    comments_raw = js("""
(() => {
  const out = [];
  const seen = new Set();

  function pushIfValid(commentUrn, profileUrl, name, text) {
    if (!profileUrl || !text) return;
    const cleanUrl = profileUrl.split("?")[0].split("#")[0].replace(/\\/+$/, "");
    const key = (commentUrn || "") + "|" + cleanUrl;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      commentUrn: commentUrn || null,
      profileUrl: cleanUrl,
      name: (name || "").trim() || null,
      text: text.trim()
    });
  }

  function extractFromContainer(el, commentUrn) {
    // Actor: prefer the /in/ link with non-empty visible text (the name link),
    // not the avatar link which wraps an <img> with no text.
    const allLinks = Array.from(el.querySelectorAll('a[href*="/in/"]'))
      .filter(a => a.offsetParent !== null);
    let actor = allLinks.find(a => ((a.textContent || "").trim().length > 0)) || allLinks[0];
    if (!actor) return;
    const profileUrl = actor.href || null;
    // Name: prefer span with text, fall back to actor textContent, then to other links
    let name = null;
    const nameEl = actor.querySelector('span[aria-hidden="true"]') || actor.querySelector('span');
    if (nameEl && (nameEl.textContent || "").trim()) name = nameEl.textContent;
    if (!name) name = (actor.textContent || "").trim();
    if (!name) {
      // Last fallback: any visible /in/ link with text inside the same container
      const named = allLinks.find(a => ((a.textContent || "").trim().length > 1));
      if (named) name = (named.textContent || "").trim();
    }
    // Text: try multiple selectors
    let textEl = el.querySelector('.update-components-text')
              || el.querySelector('[class*="comment-text-view"]')
              || el.querySelector('[class*="comments-comment-item__main-content"]')
              || el.querySelector('[class*="comment-item-main-content"]')
              || el.querySelector('.feed-shared-text');
    let text = textEl ? (textEl.innerText || textEl.textContent || "") : "";
    // If we couldn't isolate the text, grab the first reasonably-long line in the element
    if (!text || text.length < 2) {
      const all = (el.innerText || "").split("\\n").map(s => s.trim()).filter(Boolean);
      // skip the actor name line and short/likely-meta lines
      for (const line of all) {
        if (line === (name || "").trim()) continue;
        if (/^\\d+[smhd]$/.test(line)) continue;
        if (/^(like|reply|edited|author|following|connect)$/i.test(line)) continue;
        if (line.length >= 2) { text = line; break; }
      }
    }
    pushIfValid(commentUrn, profileUrl, name, text);
  }

  // Strategy A: elements with data-id starting with urn:li:comment:
  const aElems = Array.from(document.querySelectorAll('[data-id^="urn:li:comment:"]'));
  for (const el of aElems) extractFromContainer(el, el.getAttribute('data-id'));

  // Strategy B: any article with "comment" in className (avoid nested-reply double counting via seen-set)
  const bElems = Array.from(document.querySelectorAll('article'))
    .filter(a => /comment/i.test(a.className || ""));
  for (const el of bElems) extractFromContainer(el, el.getAttribute('data-id'));

  return out;
})()
""")

    comments = comments_raw or []

    # Filter out Allen's own comments. Allen's vanity URL has hyphens.
    own_url_fragment = "/in/allen-anant-thomas"
    filtered = [c for c in comments if own_url_fragment not in (c.get("profileUrl") or "")]

    out = {
        "ok": True,
        "activityId": activity_id,
        "url": final_url,
        "expandClicks": expand_count,
        "count": len(filtered),
        "totalRaw": len(comments),
        "comments": filtered,
    }
    with open(args_path, "w") as f:
        json.dump(out, f)
    print(json.dumps(out))
    return 0


main()
