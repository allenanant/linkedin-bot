"""Open fresh modal, click '+' (More), dump options."""
import json, time

# Tab
tabs = list_tabs(include_chrome=False)
feed = [t for t in tabs if t["url"].rstrip("/").endswith("linkedin.com/feed")]
target = feed[0]
switch_tab(target["targetId"])
time.sleep(1)
cdp("Emulation.setDeviceMetricsOverride", width=1440, height=900, deviceScaleFactor=1, mobile=False)
time.sleep(1)

# Reset state
press_key("Escape")
press_key("Escape")
time.sleep(1)
goto("https://www.linkedin.com/feed/")
wait_for_load()
time.sleep(5)

# Open Start a post
coords = js("""
(() => {
  const cands = Array.from(document.querySelectorAll('div, button, [role="button"]'))
    .filter(e => (e.textContent || "").trim() === "Start a post" && e.offsetParent !== null);
  if (!cands.length) return null;
  const r = cands[0].getBoundingClientRect();
  return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)};
})()
""")
click(coords["x"], coords["y"])
time.sleep(5)

# Click "More" (+) button
print("Clicking More (732, 509)...")
click(732, 509)
time.sleep(3)

screenshot("/tmp/p3-after-more.png", full=False)

# Dump everything in modal area
ALL = js("""
(() => {
  function walk(root, results) {
    if (!root || !root.querySelectorAll) return;
    for (const el of root.querySelectorAll('*')) {
      const tag = el.tagName;
      const role = el.getAttribute && el.getAttribute('role');
      if ((tag === "BUTTON" || role === "button") && el.offsetParent !== null) {
        const aria = (el.getAttribute && el.getAttribute('aria-label')) || "";
        const text = (el.textContent || "").trim().slice(0, 60);
        const r = el.getBoundingClientRect();
        results.push({
          aria, text,
          x: Math.round(r.x + r.width/2),
          y: Math.round(r.y + r.height/2),
          w: Math.round(r.width),
          h: Math.round(r.height),
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
print(f"\nMODAL AREA BUTTONS (270 < x < 1180, 50 < y < 700):")
for b in ALL:
    if 270 < b.get("x", 0) < 1180 and 50 < b.get("y", 0) < 700:
        print(f"  ({b['x']:>4},{b['y']:>4}) [{b['w']}x{b['h']}] aria={b.get('aria','')[:55]!r} text={b.get('text','')[:40]!r}")

# Also check for menu items / list items
print("\n\nMENUITEM ELEMENTS (role='menuitem' or with 'media-type' aria):")
items = js("""
(() => {
  function walk(root, results) {
    if (!root || !root.querySelectorAll) return;
    for (const el of root.querySelectorAll('*')) {
      const role = el.getAttribute && el.getAttribute('role');
      const tag = el.tagName;
      if ((role === 'menuitem' || tag === 'LI') && el.offsetParent !== null) {
        const aria = (el.getAttribute && el.getAttribute('aria-label')) || "";
        const text = (el.textContent || "").trim().slice(0, 80);
        if (aria || text.length > 2) {
          const r = el.getBoundingClientRect();
          results.push({tag, role, aria, text, x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)});
        }
      }
      if (el.shadowRoot) walk(el.shadowRoot, results);
    }
  }
  const r = [];
  walk(document, r);
  return r;
})()
""")
for b in items[:30]:
    print(f"  [{b.get('tag')} role={b.get('role')}] ({b['x']:>4},{b['y']:>4}) aria={b.get('aria','')[:30]!r} text={b.get('text','')[:60]!r}")
