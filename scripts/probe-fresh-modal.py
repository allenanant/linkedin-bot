"""Fresh modal probe: navigate to feed, dismiss any open dialogs, then open Start a post and explore."""
import json, time, sys

# Find feed tab
tabs = list_tabs(include_chrome=False)
feed = [t for t in tabs if t["url"].rstrip("/").endswith("linkedin.com/feed")]
if not feed:
    new_tab("https://www.linkedin.com/feed/")
    wait_for_load()
    time.sleep(4)
    feed = [t for t in list_tabs(include_chrome=False) if t["url"].rstrip("/").endswith("linkedin.com/feed")]

target = feed[0]
switch_tab(target["targetId"])
time.sleep(1)
cdp("Emulation.setDeviceMetricsOverride", width=1440, height=900, deviceScaleFactor=1, mobile=False)
time.sleep(1)

# Close any open modal by pressing Escape (handles native + LI modals)
press_key("Escape")
time.sleep(1)
press_key("Escape")
time.sleep(1)

# Force reload to get clean state
goto("https://www.linkedin.com/feed/")
wait_for_load()
time.sleep(5)

screenshot("/tmp/p1-feed-clean.png", full=False)

# Find Start a post
coords = js("""
(() => {
  const cands = Array.from(document.querySelectorAll('div, button, [role="button"]'))
    .filter(e => (e.textContent || "").trim() === "Start a post" && e.offsetParent !== null);
  if (!cands.length) return null;
  const r = cands[0].getBoundingClientRect();
  return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)};
})()
""")
print("START_POST:", coords)
click(coords["x"], coords["y"])
time.sleep(6)

screenshot("/tmp/p2-modal-open.png", full=False)

# Dump only buttons in modal area (modal y range ~50-650, x ~280-1100)
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
        const text = (el.textContent || "").trim().slice(0, 60);
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
print(f"\nALL VISIBLE BUTTONS ({len(ALL)}):")
print("Modal-area (270 < x < 1180, 50 < y < 700):")
for b in ALL:
    if 270 < b.get("x", 0) < 1180 and 50 < b.get("y", 0) < 700:
        print(f"  ({b['x']:>4},{b['y']:>4}) [{b['w']}x{b['h']}] aria={b.get('aria','')[:55]!r} text={b.get('text','')[:30]!r}")
