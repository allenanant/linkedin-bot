"""Find Allen's vanity URL by navigating to feed and reading profile link."""
import time

tabs = list_tabs(include_chrome=False)
li = [t for t in tabs if "linkedin.com/feed" in t["url"]]
if not li:
    new_tab("https://www.linkedin.com/feed/")
    wait_for_load()
    time.sleep(4)
    li = [t for t in list_tabs(include_chrome=False) if "linkedin.com/feed" in t["url"]]
target = li[0]
switch_tab(target["targetId"])
time.sleep(1)
cdp("Emulation.setDeviceMetricsOverride", width=1440, height=900, deviceScaleFactor=1, mobile=False)
time.sleep(1)

# Look for the profile vanity URL in any /in/ link
result = js("""
(() => {
  const links = Array.from(document.querySelectorAll('a[href*="/in/"]'));
  const vanity = new Set();
  for (const a of links) {
    const m = a.href.match(/linkedin\\.com\\/in\\/([^/?]+)/);
    if (m) vanity.add(m[1]);
  }
  return Array.from(vanity).slice(0, 10);
})()
""")
print("VANITY URLS:", result)
