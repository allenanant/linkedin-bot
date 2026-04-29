"""Probe file chooser interception:
1. Enable Page.setInterceptFileChooserDialog
2. Click Add media
3. Drain events looking for Page.fileChooserOpened
"""
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
press_key("Escape"); time.sleep(0.5)
press_key("Escape"); time.sleep(0.5)
goto("https://www.linkedin.com/feed/")
wait_for_load()
time.sleep(5)

# Enable Page domain (required for file chooser events)
cdp("Page.enable")
print("Page.enable called")

# Enable file chooser interception BEFORE clicking
cdp("Page.setInterceptFileChooserDialog", enabled=True)
print("setInterceptFileChooserDialog enabled")

# Drain any stale events
drain_events()

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

# Click "Add media" at (564, 509)
print("Clicking Add media (564, 509)...")
click(564, 509)
time.sleep(3)

# Drain events
events = drain_events()
print(f"\nEVENTS AFTER ADD MEDIA: {len(events)}")
for ev in events[:20]:
    method = ev.get("method", "?")
    if "fileChooser" in method or "Page" in method:
        print(f"  {method}: {json.dumps(ev.get('params', {}))[:150]}")

# Look specifically for fileChooserOpened
chooser = [ev for ev in events if ev.get("method") == "Page.fileChooserOpened"]
print(f"\nFILE CHOOSER OPENED EVENTS: {len(chooser)}")
for ev in chooser:
    print(f"  params: {ev.get('params')}")

screenshot("/tmp/p4-after-addmedia.png", full=False)

# Did we get a sub-screen with media types? Or did file picker open?
allbtns = js("""
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
        if (270 < r.x + r.width/2 && r.x + r.width/2 < 1180 && 50 < r.y + r.height/2 && r.y + r.height/2 < 700) {
          results.push({aria, text, x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)});
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
print(f"\nMODAL BUTTONS AFTER ADD MEDIA CLICK ({len(allbtns)}):")
for b in allbtns:
    if b.get("aria") or (b.get("text") and len(b["text"]) > 1 and len(b["text"]) < 30):
        print(f"  ({b['x']:>4},{b['y']:>4}) aria={b.get('aria','')[:50]!r} text={b.get('text','')!r}")
