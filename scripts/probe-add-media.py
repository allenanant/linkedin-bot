"""Open modal, click 'Add media', dump what shows up."""
import json, time

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

# Open modal
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

screenshot("/tmp/before-addmedia.png", full=False)

# Click "Add media" button (was at 564, 509)
click(564, 509)
time.sleep(3)

screenshot("/tmp/after-addmedia.png", full=False)

# Now dump everything visible
ALL = js("""
(() => {
  function walk(root, results) {
    if (!root || !root.querySelectorAll) return;
    for (const el of root.querySelectorAll('*')) {
      const tag = el.tagName;
      const role = el.getAttribute && el.getAttribute('role');
      const isInput = tag === "INPUT" && el.getAttribute('type') === 'file';
      if ((tag === "BUTTON" || role === "button" || isInput) && (el.offsetParent !== null || isInput)) {
        const aria = (el.getAttribute && el.getAttribute('aria-label')) || "";
        const title = (el.getAttribute && el.getAttribute('title')) || "";
        const text = (el.textContent || "").trim().slice(0, 50);
        const r = el.getBoundingClientRect();
        results.push({
          tag, isInput,
          aria, title, text,
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
print(f"TOTAL_BUTTONS_AND_INPUTS: {len(ALL)}")
print("VISIBLE BUTTONS WITH ARIA/TITLE OR FILE INPUTS:")
for b in ALL:
    if b.get("isInput") or b.get("aria") or b.get("title"):
        print(f"  [{b['tag']}{'(file)' if b['isInput'] else ''}] ({b['x']:>4},{b['y']:>4}) [{b['w']}x{b['h']}] aria={b.get('aria','')[:50]!r} title={b.get('title','')[:30]!r} text={b.get('text','')[:30]!r}")
