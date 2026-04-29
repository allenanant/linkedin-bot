"""Check Allen's recent activity feed to see if a test post is live."""
import json, time

tabs = list_tabs(include_chrome=False)
li = [t for t in tabs if "linkedin.com" in t["url"]]
if not li:
    new_tab("https://www.linkedin.com/feed/")
    wait_for_load()
    time.sleep(4)
    li = [t for t in list_tabs(include_chrome=False) if "linkedin.com" in t["url"]]
target = li[0]
switch_tab(target["targetId"])
time.sleep(1)
cdp("Emulation.setDeviceMetricsOverride", width=1440, height=900, deviceScaleFactor=1, mobile=False)
time.sleep(1)
press_key("Escape"); time.sleep(0.3)
press_key("Escape"); time.sleep(0.3)

goto("https://www.linkedin.com/in/allenanantthomas/recent-activity/all/")
wait_for_load()
time.sleep(6)

screenshot("/tmp/recent-activity.png", full=False)

# Get text of the most recent posts
recent = js("""
(() => {
  const posts = Array.from(document.querySelectorAll('[data-urn*="urn:li:activity"]'));
  return posts.slice(0, 5).map(p => {
    const urn = p.getAttribute('data-urn');
    const t = (p.textContent || "").trim().slice(0, 200);
    return {urn, text: t};
  });
})()
""")
print("RECENT POSTS:")
for r in recent:
    print(f"  {r['urn']}")
    print(f"    {r['text']!r}")
