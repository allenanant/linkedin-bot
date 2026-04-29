"""Full media upload probe (no Post click):
1. Open modal
2. Enable file chooser interception
3. Click Add media
4. Capture fileChooserOpened, get backendNodeId
5. Call DOM.setFileInputFiles with test image
6. Wait for upload completion (Next / Done button enabled)
7. Screenshot. DO NOT POST.
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

press_key("Escape"); time.sleep(0.5)
press_key("Escape"); time.sleep(0.5)
goto("https://www.linkedin.com/feed/")
wait_for_load()
time.sleep(5)

cdp("Page.enable")
cdp("Page.setInterceptFileChooserDialog", enabled=True)
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

# Click Add media
click(564, 509)
time.sleep(3)

# Wait for fileChooserOpened
chooser = None
for i in range(20):
    events = drain_events()
    for ev in events:
        if ev.get("method") == "Page.fileChooserOpened":
            chooser = ev.get("params", {})
            break
    if chooser:
        break
    time.sleep(0.5)

if not chooser:
    screenshot("/tmp/p5-no-chooser.png", full=False)
    print("ERROR: fileChooserOpened never fired")
    raise SystemExit(1)

backend_node_id = chooser.get("backendNodeId")
print(f"GOT FILE CHOOSER, backendNodeId={backend_node_id}")

# Set the file
cdp("DOM.setFileInputFiles", files=["/tmp/test-image.png"], backendNodeId=backend_node_id)
print("setFileInputFiles called")
time.sleep(5)

# Screenshot to see upload progress
screenshot("/tmp/p5-after-upload.png", full=False)

# Look for Next / Done buttons
def find_btn(label):
    return js(f"""
(() => {{
  function find(root) {{
    if (!root || !root.querySelectorAll) return null;
    for (const el of root.querySelectorAll('*')) {{
      if (el.tagName === "BUTTON" && (el.textContent || "").trim() === {json.dumps(label)} && el.offsetParent !== null) {{
        const r = el.getBoundingClientRect();
        return {{x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), disabled: !!el.disabled}};
      }}
      if (el.shadowRoot) {{
        const f = find(el.shadowRoot);
        if (f) return f;
      }}
    }}
    return null;
  }}
  return find(document);
}})()""")

# Wait up to 30s for Next to be enabled
print("\nWatching for Next button to enable...")
for sec in range(30):
    nxt = find_btn("Next")
    done = find_btn("Done")
    if nxt:
        print(f"  sec={sec}: Next found at ({nxt['x']},{nxt['y']}) disabled={nxt['disabled']}")
        if not nxt["disabled"]:
            print("  Next ENABLED!")
            break
    elif done:
        print(f"  sec={sec}: Done found at ({done['x']},{done['y']}) disabled={done['disabled']}")
        if not done["disabled"]:
            print("  Done ENABLED!")
            break
    time.sleep(1)

screenshot("/tmp/p5-final.png", full=False)
print("\nFINAL SCREENSHOT: /tmp/p5-final.png")

# Final state of modal
final_btns = js("""
(() => {
  function walk(root, results) {
    if (!root || !root.querySelectorAll) return;
    for (const el of root.querySelectorAll('*')) {
      if (el.tagName === "BUTTON" && el.offsetParent !== null) {
        const aria = (el.getAttribute && el.getAttribute('aria-label')) || "";
        const text = (el.textContent || "").trim().slice(0, 40);
        if (aria || (text && text.length < 30)) {
          const r = el.getBoundingClientRect();
          if (r.y > 50 && r.y < 800 && r.x > 200 && r.x < 1200) {
            results.push({aria, text, x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), disabled: el.disabled});
          }
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
print(f"\nFINAL BUTTONS ({len(final_btns)}):")
for b in final_btns[:30]:
    print(f"  ({b['x']:>4},{b['y']:>4}) disabled={b['disabled']} aria={b.get('aria','')[:40]!r} text={b.get('text','')!r}")
