"""Open modal, click +, dump every aria-label visible inside the modal."""
import time, json

# Tab cleanup
tabs = list_tabs(include_chrome=False)
feed_tabs = [t for t in tabs if "/feed" in t["url"]]
if not feed_tabs:
    new_tab("https://www.linkedin.com/feed/")
    wait_for_load()
    time.sleep(3)
    feed_tabs = [t for t in list_tabs(include_chrome=False) if "/feed" in t["url"]]
keep = feed_tabs[0]
switch_tab(keep["targetId"])
for t in feed_tabs[1:]:
    try: cdp("Target.closeTarget", targetId=t["targetId"])
    except Exception: pass
time.sleep(2)

goto("https://www.linkedin.com/feed/")
wait_for_load()
time.sleep(4)
cdp("Emulation.setDeviceMetricsOverride", width=1440, height=900, deviceScaleFactor=1, mobile=False)
time.sleep(2)

# Open composer
coords = js("""
(() => {
  const el = Array.from(document.querySelectorAll('div, button, [role="button"]'))
    .find(e => (e.textContent || "").trim() === "Start a post" && e.offsetParent !== null);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)};
})()
""")
click(coords["x"], coords["y"])
time.sleep(7)

# Shadow-walk and dump every visible button with aria-label or title in the modal
ALL = js("""
(() => {
  function walk(root, results) {
    if (!root || !root.querySelectorAll) return;
    for (const el of root.querySelectorAll('*')) {
      if ((el.tagName === "BUTTON" || el.getAttribute && el.getAttribute('role') === 'button') && el.offsetParent !== null) {
        const aria = (el.getAttribute && el.getAttribute('aria-label')) || "";
        const title = (el.getAttribute && el.getAttribute('title')) || "";
        const text = (el.textContent || "").trim().slice(0, 40);
        if (aria || title) {
          const r = el.getBoundingClientRect();
          results.push({
            aria, title, text,
            x: Math.round(r.x + r.width/2),
            y: Math.round(r.y + r.height/2),
            disabled: !!el.disabled,
          });
        }
      }
      if (el.shadowRoot) walk(el.shadowRoot, results);
    }
  }
  const results = [];
  walk(document, results);
  return results;
})()
""")

# Filter for likely toolbar buttons (in modal area, y > 400)
print("ALL VISIBLE BUTTONS WITH ARIA/TITLE (y > 400):")
for b in ALL:
    if b.get("y", 0) > 400 and b.get("y", 0) < 700:
        print(f"  ({b['x']:>4}, {b['y']:>4})  aria={b.get('aria','')[:60]!r}  title={b.get('title','')[:30]!r}  text={b.get('text','')!r}")
print(f"TOTAL VISIBLE: {len(ALL)}")
screenshot("/tmp/modal-state.png", full=False)
