"""Probe modal: connect to existing feed tab, open Start a post, dump every button.

Outputs JSON to stdout so we can capture cleanly.
"""
import json, time, sys

# --- Find a real feed tab; close any modal-detail / activity tabs that match ---
all_tabs = list_tabs(include_chrome=False)
feed_root = [t for t in all_tabs if t["url"].rstrip("/").endswith("linkedin.com/feed") or t["url"].endswith("linkedin.com/feed/")]
if not feed_root:
    # Open a fresh feed tab
    new_tab("https://www.linkedin.com/feed/")
    wait_for_load()
    time.sleep(4)
    all_tabs = list_tabs(include_chrome=False)
    feed_root = [t for t in all_tabs if t["url"].rstrip("/").endswith("linkedin.com/feed")]

if not feed_root:
    print(json.dumps({"error": "no feed tab found", "all_tabs": [t["url"] for t in all_tabs[:10]]}))
    sys.exit(1)

# Switch to the first feed tab; do NOT navigate (avoids "Leave site?" dialog)
tab = feed_root[0]
switch_tab(tab["targetId"])
time.sleep(1)

# Set viewport
cdp("Emulation.setDeviceMetricsOverride", width=1440, height=900, deviceScaleFactor=1, mobile=False)
time.sleep(1)

# Take a screenshot to confirm tab state
screenshot("/tmp/feed-state.png", full=False)

# Find Start a post button
coords = js("""
(() => {
  const cands = Array.from(document.querySelectorAll('div, button, [role="button"]'))
    .filter(e => (e.textContent || "").trim() === "Start a post" && e.offsetParent !== null);
  if (!cands.length) return null;
  const r = cands[0].getBoundingClientRect();
  return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)};
})()
""")
print(json.dumps({"start_post_coords": coords}))

if not coords:
    screenshot("/tmp/no-share-box.png", full=False)
    print(json.dumps({"error": "no Start a post button"}))
    sys.exit(1)

click(coords["x"], coords["y"])
time.sleep(6)

screenshot("/tmp/modal-open.png", full=False)

# Dump all visible buttons + their aria/title
ALL = js("""
(() => {
  function walk(root, results) {
    if (!root || !root.querySelectorAll) return;
    for (const el of root.querySelectorAll('*')) {
      const tag = el.tagName;
      const role = el.getAttribute && el.getAttribute('role');
      if ((tag === "BUTTON" || role === "button") && el.offsetParent !== null) {
        const aria = (el.getAttribute && el.getAttribute('aria-label')) || "";
        const title = (el.getAttribute && el.getAttribute('title')) || "";
        const text = (el.textContent || "").trim().slice(0, 50);
        const r = el.getBoundingClientRect();
        results.push({
          aria, title, text,
          x: Math.round(r.x + r.width/2),
          y: Math.round(r.y + r.height/2),
          w: Math.round(r.width),
          h: Math.round(r.height),
          disabled: !!el.disabled,
        });
      }
      if (el.shadowRoot) walk(el.shadowRoot, results);
    }
  }
  const r = [];
  walk(document, r);
  return r;
})()
""")

# Filter to buttons in modal area (typically y between ~150 and ~750, x from ~300 to ~1100)
print(f"TOTAL_VISIBLE: {len(ALL)}")
print("MODAL_AREA_BUTTONS (y in [200,800]):")
for b in ALL:
    if 200 <= b.get("y", 0) <= 800 and (b.get("aria") or b.get("title") or b.get("text")):
        print(f"  ({b['x']:>4},{b['y']:>4}) [{b['w']}x{b['h']}] aria={b.get('aria','')[:50]!r} title={b.get('title','')[:30]!r} text={b.get('text','')[:30]!r}")
