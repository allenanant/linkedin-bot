"""Check LinkedIn connection status for a profile.

Args (env LI_CHECK_CONN_ARGS_PATH points to JSON file):
  { "profileUrl": "https://www.linkedin.com/in/foo-bar/" }

Result (overwrites the same JSON file):
  {
    "ok": true,
    "profileUrl": "...",
    "status": "connected" | "not_connected" | "pending" | "self" | "unknown",
    "evidence": "Message button visible / Connect button visible / Pending / Edit profile",
    "screenshotPath": "/tmp/li-check-conn-<status>.png"
  }

Strategy:
  1. Navigate to profile URL
  2. Look for connection-degree badge near the name (.dist-value, [aria-label*="degree connection"])
  3. Fallback: top-card action buttons — "Message" / "Connect" / "Pending" / "Edit profile" / "Follow"
"""
import json, os, sys, time


def main():
    args_path = os.environ.get("LI_CHECK_CONN_ARGS_PATH")
    if not args_path or not os.path.exists(args_path):
        print(json.dumps({"ok": False, "error": f"args file missing: {args_path}"}))
        return 1

    with open(args_path) as f:
        args = json.load(f)

    profile_url = (args.get("profileUrl") or "").strip()

    def fail(msg, shot=None):
        out = {"ok": False, "error": msg}
        if shot:
            out["screenshotPath"] = shot
        with open(args_path, "w") as f:
            json.dump(out, f)
        print(json.dumps(out))
        sys.exit(1)

    if not profile_url:
        fail("missing profileUrl")

    if not profile_url.startswith("https://www.linkedin.com/in/") and "/in/" not in profile_url:
        fail(f"profileUrl looks invalid: {profile_url}")

    # Switch to or open a /feed tab so navigation is clean
    tabs = list_tabs(include_chrome=False)
    feed = [t for t in tabs if "linkedin.com" in t["url"]]
    if feed:
        switch_tab(feed[0]["targetId"])
    else:
        new_tab("https://www.linkedin.com/feed/")
        wait_for_load()
        time.sleep(3)

    cdp("Emulation.setDeviceMetricsOverride", width=1440, height=900, deviceScaleFactor=1, mobile=False)
    time.sleep(0.4)

    press_key("Escape"); time.sleep(0.2)
    goto(profile_url)
    wait_for_load()
    time.sleep(5)

    # Poll for the top-card name heading to render. LinkedIn lazy-loads.
    for _ in range(15):
        has_h1 = js("!!document.querySelector('main h1') || !!document.querySelector('h1')")
        if has_h1:
            break
        time.sleep(1)
    time.sleep(1)

    info = page_info()
    final_url = info.get("url", "")
    if "/in/" not in final_url:
        screenshot("/tmp/li-check-conn-redirected.png", full=False)
        fail(f"redirected away from profile: {final_url}", "/tmp/li-check-conn-redirected.png")

    # Read connection signals from the DOM using SPATIAL filtering — only buttons
    # within the top card area (~350px below the name heading). Excludes sidebar
    # "More profiles for you" Connect buttons that previously caused false positives.
    signals = js("""
(() => {
  function textOf(el) { return ((el && (el.textContent || el.innerText)) || "").trim(); }
  const main = document.querySelector('main');
  if (!main) return { scopedFound: false };
  const h1 = main.querySelector('h1') || document.querySelector('h1');

  // Degree from inside main only — text-based fallback covers most variations.
  let degree = null;
  for (const sel of ['.dist-value', '[class*="distance__value"]', '[class*="distance-badge"]', '[class*="degree"]']) {
    const el = main.querySelector(sel);
    if (el) {
      const t = (el.textContent || '').trim().toLowerCase();
      if (/1st/.test(t)) { degree = '1st'; break; }
      if (/2nd/.test(t)) { degree = '2nd'; break; }
      if (/3rd/.test(t)) { degree = '3rd'; break; }
    }
  }
  if (!degree) {
    const snippet = (main.innerText || '').slice(0, 1500);
    if (/·\\s*1st\\b/.test(snippet) || /\\b1st-degree\\b/i.test(snippet)) degree = '1st';
    else if (/·\\s*2nd\\b/.test(snippet)) degree = '2nd';
    else if (/·\\s*3rd\\b/.test(snippet)) degree = '3rd';
  }

  // Spatial filter: only buttons positioned NEAR the H1 (top-card area).
  let h1Y = 0;
  if (h1) {
    const r = h1.getBoundingClientRect();
    h1Y = r.y + window.scrollY;
  }
  function isInTopCard(b) {
    if (!h1) return true;
    const br = b.getBoundingClientRect();
    const by = br.y + window.scrollY;
    return by >= h1Y - 80 && by <= h1Y + 380;
  }
  const buttons = Array.from(main.querySelectorAll('button, a[role="button"]'))
    .filter(b => b.offsetParent !== null && isInTopCard(b));

  function hasBtn(needle) {
    const re = new RegExp(needle, "i");
    return buttons.some(b => re.test(textOf(b)) || re.test((b.getAttribute('aria-label') || "")));
  }

  return {
    name: h1 ? textOf(h1) : null,
    degree,
    scopedFound: true,
    topCardButtonCount: buttons.length,
    hasMessage: hasBtn('^message$|^message [a-z]'),
    hasConnect: hasBtn('^connect$|^invite to connect'),
    hasPending: hasBtn('^pending$|^withdraw'),
    hasEditProfile: hasBtn('^edit profile$'),
    hasFollow: hasBtn('^follow$|^following$'),
  };
})()
""") or {}

    # Decide status
    status = "unknown"
    evidence_parts = []
    if signals.get("hasEditProfile"):
        status = "self"
        evidence_parts.append("Edit profile visible")
    elif signals.get("hasPending"):
        status = "pending"
        evidence_parts.append("Pending button")
    elif signals.get("degree") == "1st" or signals.get("hasMessage") and not signals.get("hasConnect"):
        status = "connected"
        if signals.get("degree") == "1st":
            evidence_parts.append("1st-degree badge")
        if signals.get("hasMessage"):
            evidence_parts.append("Message button")
    elif signals.get("hasConnect") or signals.get("degree") in ("2nd", "3rd"):
        status = "not_connected"
        if signals.get("degree"):
            evidence_parts.append(f"{signals['degree']}-degree badge")
        if signals.get("hasConnect"):
            evidence_parts.append("Connect button")

    shot = f"/tmp/li-check-conn-{status}.png"
    try:
        screenshot(shot, full=False)
    except Exception:
        shot = None

    out = {
        "ok": True,
        "profileUrl": profile_url,
        "status": status,
        "evidence": "; ".join(evidence_parts) or "no clear markers",
        "name": signals.get("name"),
        "screenshotPath": shot,
    }
    with open(args_path, "w") as f:
        json.dump(out, f)
    print(json.dumps(out))
    return 0


main()
