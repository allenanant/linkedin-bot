"""Delete the most recent post on Allen's LinkedIn feed (or by activity ID).

Args via env LI_DELETE_ARGS_PATH (JSON file):
  {"activityId": "1234567" | null}  // null = newest visible post by Allen

Result (overwrites the file):
  {"ok": true, "deleted": true, "activityId": "..."}
  {"ok": false, "error": "..."}

Flow:
  1. Switch to feed tab
  2. Navigate to recent activity URL
  3. Click the "Open control menu for post by ..." button on the most recent
  4. Click "Delete post" menu item
  5. Confirm "Delete" in the confirmation modal
"""
import json, os, sys, time


def main():
    ARGS_PATH = os.environ.get("LI_DELETE_ARGS_PATH")

    def write_result(out):
        if ARGS_PATH:
            with open(ARGS_PATH, "w") as f:
                json.dump(out, f)
        print(json.dumps(out))
        sys.exit(0 if out.get("ok") else 1)

    tabs = list_tabs(include_chrome=False)
    feed = [t for t in tabs if "linkedin.com" in t["url"]]
    if not feed:
        new_tab("https://www.linkedin.com/feed/")
        wait_for_load()
        time.sleep(4)
        feed = [t for t in list_tabs(include_chrome=False) if "linkedin.com" in t["url"]]

    target = feed[0]
    switch_tab(target["targetId"])
    time.sleep(1)
    cdp("Emulation.setDeviceMetricsOverride", width=1440, height=900, deviceScaleFactor=1, mobile=False)
    time.sleep(1)

    press_key("Escape"); time.sleep(0.3)
    press_key("Escape"); time.sleep(0.3)

    # Allen's activity feed
    goto("https://www.linkedin.com/in/allen-anant-thomas/recent-activity/all/")
    wait_for_load()
    time.sleep(6)

    js("window.scrollTo(0, 0)")
    time.sleep(1)

    expr = """
(() => {
  function find(root) {
    if (!root || !root.querySelectorAll) return null;
    for (const el of root.querySelectorAll('button[aria-label*="Open control menu" i], button[aria-label*="More actions" i]')) {
      if (el.offsetParent !== null) {
        const r = el.getBoundingClientRect();
        if (r.y > 50 && r.y < 1500) {
          return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), aria: el.getAttribute('aria-label')};
        }
      }
    }
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) {
        const f = find(el.shadowRoot);
        if (f) return f;
      }
    }
    return null;
  }
  return find(document);
})()
"""
    ctrl = js(expr)
    if not ctrl:
        screenshot("/tmp/li-no-control-menu.png", full=False)
        write_result({"ok": False, "error": "no control-menu button on activity feed", "screenshotPath": "/tmp/li-no-control-menu.png"})

    print(f"FOUND CONTROL MENU at ({ctrl['x']},{ctrl['y']}): {ctrl.get('aria')}")
    click(ctrl["x"], ctrl["y"])
    time.sleep(2)

    screenshot("/tmp/li-menu-open.png", full=False)

    del_btn = js("""
(() => {
  function find(root) {
    if (!root || !root.querySelectorAll) return null;
    for (const el of root.querySelectorAll('*')) {
      const t = (el.textContent || "").trim();
      if ((t === "Delete post" || t === "Delete") && el.offsetParent !== null) {
        const tag = el.tagName;
        const role = el.getAttribute && el.getAttribute('role');
        if (tag === "BUTTON" || tag === "DIV" || tag === "SPAN" || tag === "LI" || role === "menuitem" || role === "button") {
          const r = el.getBoundingClientRect();
          if (r.width > 10 && r.height > 10) {
            return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), tag, role, text: t};
          }
        }
      }
      if (el.shadowRoot) {
        const f = find(el.shadowRoot);
        if (f) return f;
      }
    }
    return null;
  }
  return find(document);
})()
""")
    if not del_btn:
        screenshot("/tmp/li-no-delete.png", full=False)
        write_result({"ok": False, "error": "Delete menu item not found", "screenshotPath": "/tmp/li-no-delete.png"})

    print(f"FOUND DELETE at ({del_btn['x']},{del_btn['y']}) {del_btn.get('tag')} {del_btn.get('role')}")
    click(del_btn["x"], del_btn["y"])
    time.sleep(3)

    screenshot("/tmp/li-confirm-delete.png", full=False)

    confirm = js("""
(() => {
  function find(root) {
    if (!root || !root.querySelectorAll) return null;
    for (const el of root.querySelectorAll('button')) {
      const t = (el.textContent || "").trim();
      if (t === "Delete" && el.offsetParent !== null) {
        const r = el.getBoundingClientRect();
        return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), disabled: !!el.disabled};
      }
    }
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) {
        const f = find(el.shadowRoot);
        if (f) return f;
      }
    }
    return null;
  }
  return find(document);
})()
""")
    if not confirm:
        screenshot("/tmp/li-no-confirm.png", full=False)
        write_result({"ok": False, "error": "Delete confirmation button not found", "screenshotPath": "/tmp/li-no-confirm.png"})

    click(confirm["x"], confirm["y"])
    time.sleep(5)

    screenshot("/tmp/li-after-delete.png", full=False)
    write_result({"ok": True, "deleted": True, "screenshotPath": "/tmp/li-after-delete.png"})


main()
