"""Test: open modal, type text into auto-focused editor, screenshot to verify."""
import time

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

coords = js("""
(() => {
  const el = Array.from(document.querySelectorAll('div, button, [role="button"]'))
    .find(e => (e.textContent || "").trim() === "Start a post" && e.offsetParent !== null);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)};
})()
""")
print("COORDS:", coords)
click(coords["x"], coords["y"])
time.sleep(6)

# Try typing into the auto-focused editor
type_text("DRAFT TEST: This is a typed-via-CDP test post. If you see this, browser-harness can drive LinkedIn's post composer end-to-end.")
time.sleep(3)
screenshot("/tmp/typed.png", full=False)
print("typed screenshot saved")

# Check if Post button became enabled (still in shadow DOM, but we can shadow-walk)
post_state = js("""
(() => {
  function find(root) {
    if (!root) return null;
    const elements = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const el of elements) {
      if (el.tagName === "BUTTON" && (el.textContent || "").trim() === "Post" && el.offsetParent !== null) {
        const r = el.getBoundingClientRect();
        return {disabled: el.disabled, x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), aria: el.getAttribute('aria-label')};
      }
      if (el.shadowRoot) {
        const found = find(el.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }
  return find(document);
})()
""")
print("POST BUTTON:", post_state)
