"""Probe what's in the document upload sub-modal."""
import time, json

tabs = list_tabs(include_chrome=False)
li = [t for t in tabs if "linkedin.com/feed" in t["url"]]
target = li[0]
switch_tab(target["targetId"])
time.sleep(1)
cdp("Emulation.setDeviceMetricsOverride", width=1440, height=900, deviceScaleFactor=1, mobile=False)
time.sleep(1)
press_key("Escape"); time.sleep(0.3)
press_key("Escape"); time.sleep(0.3)
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

# Click More
click(732, 509)
time.sleep(2)
# Click Add a document
click(844, 509)
time.sleep(3)

screenshot("/tmp/doc-submodal.png", full=False)

# Dump everything visible
ALL = js("""
(() => {
  function walk(root, results) {
    if (!root || !root.querySelectorAll) return;
    for (const el of root.querySelectorAll('*')) {
      const tag = el.tagName;
      const role = el.getAttribute && el.getAttribute('role');
      const isInput = tag === "INPUT" && el.getAttribute('type') === 'file';
      const isLabel = tag === "LABEL";
      if ((tag === "BUTTON" || role === "button" || isInput || isLabel) && (el.offsetParent !== null || isInput)) {
        const aria = (el.getAttribute && el.getAttribute('aria-label')) || "";
        const text = (el.textContent || "").trim().slice(0, 50);
        const r = el.getBoundingClientRect();
        if (270 < r.x + r.width/2 && r.x + r.width/2 < 1180 && 50 < r.y + r.height/2 && r.y + r.height/2 < 700) {
          results.push({tag, isInput, isLabel, aria, text, x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)});
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
print(f"VISIBLE BUTTONS/INPUTS/LABELS IN MODAL ({len(ALL)}):")
for b in ALL:
    print(f"  [{b['tag']}] ({b['x']:>4},{b['y']:>4}) aria={b.get('aria','')[:40]!r} text={b.get('text','')[:50]!r}")
