"""Sweep LinkedIn invitation manager and accept matched profiles.

Args (env LI_ACCEPT_ARGS_PATH points to JSON file):
  {
    "profileUrls": [
      "https://www.linkedin.com/in/foo-bar",
      "https://www.linkedin.com/in/baz-qux"
    ]
  }

Result (overwrites the same JSON file):
  {
    "ok": true,
    "inspectedCount": 12,
    "acceptedProfileUrls": ["https://www.linkedin.com/in/foo-bar"],
    "screenshotPath": "..."
  }

Strategy:
  1. Navigate to /mynetwork/invitation-manager/received/
  2. Click "Show more" until all current invites are loaded (cap)
  3. For each invitation card, extract the inviter's /in/ link
  4. If it matches an entry in profileUrls (exact or substring match), click the Accept button inside that card
  5. Return list of accepted profile URLs
"""
import json, os, sys, time


def main():
    args_path = os.environ.get("LI_ACCEPT_ARGS_PATH")
    if not args_path or not os.path.exists(args_path):
        print(json.dumps({"ok": False, "error": f"args file missing: {args_path}"}))
        return 1

    with open(args_path) as f:
        args = json.load(f)

    target_urls = args.get("profileUrls") or []
    if not isinstance(target_urls, list):
        target_urls = []

    def fail(msg, shot=None):
        out = {"ok": False, "error": msg}
        if shot:
            out["screenshotPath"] = shot
        with open(args_path, "w") as f:
            json.dump(out, f)
        print(json.dumps(out))
        sys.exit(1)

    if not target_urls:
        out = {"ok": True, "inspectedCount": 0, "acceptedProfileUrls": []}
        with open(args_path, "w") as f:
            json.dump(out, f)
        print(json.dumps(out))
        return 0

    # Normalize comparison keys to /in/<vanity> fragments
    def vanity_of(url):
        if not url:
            return None
        u = url.lower().split("?")[0].split("#")[0].rstrip("/")
        idx = u.find("/in/")
        if idx == -1:
            return None
        return u[idx:].split("/")[2] if len(u[idx:].split("/")) > 2 else u[idx:].split("/")[1]

    target_vanities = set(filter(None, (vanity_of(u) for u in target_urls)))

    # Switch to a LinkedIn tab
    tabs = list_tabs(include_chrome=False)
    feed = [t for t in tabs if "linkedin.com" in t["url"]]
    if feed:
        switch_tab(feed[0]["targetId"])
    else:
        new_tab("https://www.linkedin.com/feed/")
        wait_for_load()
        time.sleep(3)

    cdp("Emulation.setDeviceMetricsOverride", width=1440, height=2200, deviceScaleFactor=1, mobile=False)
    time.sleep(0.4)

    press_key("Escape"); time.sleep(0.2)
    goto("https://www.linkedin.com/mynetwork/invitation-manager/received/")
    wait_for_load()
    time.sleep(5)

    # Expand "Show more" until exhausted
    for _ in range(15):
        more = js("""
(() => {
  for (const b of document.querySelectorAll('button, [role="button"]')) {
    const t = (b.textContent || "").trim().toLowerCase();
    if ((t === 'show more' || t.startsWith('show more')) && b.offsetParent !== null && !b.disabled) {
      b.scrollIntoView({block: "center"});
      const r = b.getBoundingClientRect();
      return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)};
    }
  }
  return null;
})()
""")
        if not more:
            break
        click(more["x"], more["y"])
        time.sleep(2)

    # Pull all invitations: vanity, profile URL, accept-button coords
    invites = js("""
((targetVanitiesArr) => {
  const targets = new Set(targetVanitiesArr);
  const out = [];
  // Each invitation card is typically <li> in an invitation list, or a div with classnames matching "invitation-card"
  const cards = Array.from(document.querySelectorAll('li, div'))
    .filter(el => /invitation-card|invitation-entity|invite-card|mn-invitation/i.test(el.className || ""));
  // Fallback if nothing matched: any element containing both an /in/ link AND an Accept button
  const seen = new Set();
  function collectFromCard(card) {
    const link = card.querySelector('a[href*="/in/"]');
    if (!link) return;
    const href = (link.href || "").toLowerCase();
    let vanity = null;
    const idx = href.indexOf('/in/');
    if (idx !== -1) {
      const after = href.slice(idx + 4).split('/')[0].split('?')[0];
      vanity = after;
    }
    if (!vanity) return;
    // Find Accept button inside card
    let acceptBtn = null;
    for (const b of card.querySelectorAll('button, [role="button"]')) {
      const t = (b.textContent || "").trim().toLowerCase();
      const lbl = (b.getAttribute('aria-label') || "").toLowerCase();
      if ((t === 'accept' || /^accept .* invitation/.test(lbl)) && b.offsetParent !== null && !b.disabled) {
        acceptBtn = b; break;
      }
    }
    if (!acceptBtn) return;
    if (seen.has(vanity)) return;
    seen.add(vanity);
    const r = acceptBtn.getBoundingClientRect();
    out.push({
      vanity,
      profileUrl: href,
      isTarget: targets.has(vanity),
      btnX: Math.round(r.x + r.width/2),
      btnY: Math.round(r.y + r.height/2),
    });
  }
  for (const card of cards) collectFromCard(card);
  if (!out.length) {
    // Fallback: every Accept button
    for (const b of document.querySelectorAll('button')) {
      const t = (b.textContent || "").trim().toLowerCase();
      if (t !== 'accept') continue;
      // walk up to find the closest container with /in/ link
      let n = b;
      for (let i = 0; i < 10 && n; i++) {
        const link = n.querySelector && n.querySelector('a[href*="/in/"]');
        if (link) {
          collectFromCard(n);
          break;
        }
        n = n.parentElement;
      }
    }
  }
  return out;
})(""" + json.dumps(list(target_vanities)) + ")") or []

    accepted = []
    for inv in invites:
        if not inv.get("isTarget"):
            continue
        try:
            # Scroll the button into view, then click
            js("""
((y) => { window.scrollTo(0, Math.max(0, y - 300)); })(""" + str(inv.get("btnY", 0)) + ")")
            time.sleep(0.5)
            click(inv["btnX"], inv["btnY"])
            time.sleep(2)
            accepted.append(inv["profileUrl"])
        except Exception as e:
            print(f"  failed to accept {inv.get('vanity')}: {e}")

    shot = "/tmp/li-accept-after.png"
    try:
        screenshot(shot, full=False)
    except Exception:
        shot = None

    out = {
        "ok": True,
        "inspectedCount": len(invites),
        "acceptedProfileUrls": accepted,
        "screenshotPath": shot,
    }
    with open(args_path, "w") as f:
        json.dump(out, f)
    print(json.dumps(out))
    return 0


main()
