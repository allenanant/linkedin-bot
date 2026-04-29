"""Send a LinkedIn DM with an optional PDF attachment.

Args (env LI_DM_ARGS_PATH points to JSON file):
  {
    "profileUrl": "https://www.linkedin.com/in/foo-bar/",
    "message": "Hey {name}, here's the {magnet} as promised...",
    "attachmentPath": "/home/allen-thomas/linkedin-lead-magnets/CORPUS.pdf" | null,
    "attachmentName": "TGE Corpus Playbook.pdf" | null   // optional, for verification
  }

Result (overwrites the same JSON file):
  {
    "ok": true,
    "sentText": "...",
    "attachmentName": "..." | null,
    "screenshotPath": "..."
  }

Strategy (verified against LinkedIn UI as of 2026-04):
  1. Navigate to profile URL, click "Message"
  2. Wait for compose panel — usually opens as a bottom-right popup OR sidebar (/messaging redirect)
  3. Click the paperclip / Attach icon, then "Attach a file" item
  4. Page.setInterceptFileChooserDialog → DOM.setFileInputFiles (same trick as post-via-browser)
  5. Wait for upload preview to render in compose box
  6. Type the text message into the compose editor
  7. Click Send (Enter key OR send button)
  8. Verify panel cleared / message in conversation
"""
import json, os, sys, time


def main():
    args_path = os.environ.get("LI_DM_ARGS_PATH")
    if not args_path or not os.path.exists(args_path):
        print(json.dumps({"ok": False, "error": f"args file missing: {args_path}"}))
        return 1

    with open(args_path) as f:
        args = json.load(f)

    profile_url = (args.get("profileUrl") or "").strip()
    message = (args.get("message") or "").strip()
    attachment_path = args.get("attachmentPath")
    attachment_name = args.get("attachmentName")

    def fail(msg, shot=None):
        out = {"ok": False, "error": msg}
        if shot:
            out["screenshotPath"] = shot
        with open(args_path, "w") as f:
            json.dump(out, f)
        print(json.dumps(out))
        sys.exit(1)

    if not profile_url:
        fail("missing profileUrl")
    if not message:
        fail("missing message")
    if attachment_path and not os.path.exists(attachment_path):
        fail(f"attachmentPath does not exist: {attachment_path}")

    # Switch to /feed tab
    tabs = list_tabs(include_chrome=False)
    feed = [t for t in tabs if "linkedin.com" in t["url"]]
    if feed:
        switch_tab(feed[0]["targetId"])
    else:
        new_tab("https://www.linkedin.com/feed/")
        wait_for_load()
        time.sleep(3)

    cdp("Emulation.setDeviceMetricsOverride", width=1440, height=900, deviceScaleFactor=1, mobile=False)
    time.sleep(0.4)

    press_key("Escape"); time.sleep(0.2)
    goto(profile_url)
    wait_for_load()
    time.sleep(5)

    cdp("Page.enable")

    # Find the compose URL — Message link's href on the profile is /messaging/compose/?profileUrn=...
    # We navigate directly instead of clicking, because on Xvfb the click-to-popup flow
    # is unreliable (popup may render off-screen).
    compose_url = js("""
(() => {
  const main = document.querySelector('main');
  if (!main) return null;
  const links = Array.from(main.querySelectorAll('a[href*="/messaging/compose"]'));
  for (const a of links) {
    if (!a.offsetParent) continue;
    if (a.href && a.href.indexOf('profileUrn=') !== -1) return a.href;
  }
  // Also check the Message button itself which is sometimes a plain <a>
  for (const el of main.querySelectorAll('a')) {
    if (!el.offsetParent) continue;
    const t = (el.textContent || "").trim().toLowerCase();
    if (t === 'message' && el.href && el.href.indexOf('/messaging/') !== -1) return el.href;
  }
  return null;
})()
""")

    if not compose_url:
        screenshot("/tmp/li-dm-no-msg-btn.png", full=False)
        fail("compose URL not found on profile (probably not connected)", "/tmp/li-dm-no-msg-btn.png")

    print(f"  [dm] navigating to compose: {compose_url[:80]}...")
    goto(compose_url)
    wait_for_load()
    time.sleep(4)

    # Poll for compose panel to appear: bottom-right popup OR redirect to /messaging/thread.
    # LinkedIn renders the panel asynchronously; we wait up to 18s for any of these signals.
    editor = None
    for poll_i in range(18):
        info = page_info()
        editor = js("""
(() => {
  function find(root) {
    if (!root || !root.querySelectorAll) return null;
    // Strategy A: msg-form-related containers (most reliable when popup opens)
    const msgForm = root.querySelector('[class*="msg-form"], [class*="msg-overlay"]');
    if (msgForm) {
      const e = msgForm.querySelector('[contenteditable="true"], div[role="textbox"]');
      if (e && e.offsetParent) {
        const r = e.getBoundingClientRect();
        return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), via: "msg-form"};
      }
    }
    // Strategy B: contenteditable with placeholder/aria mentioning message
    for (const el of root.querySelectorAll('[contenteditable="true"], div[role="textbox"]')) {
      if (!el.offsetParent) continue;
      const ph = (el.getAttribute('aria-label') || "") + " " + (el.getAttribute('aria-placeholder') || "");
      if (/message|reply|write a message/i.test(ph)) {
        const r = el.getBoundingClientRect();
        return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), via: "ph-match"};
      }
    }
    // Strategy C: any visible contenteditable that's NEW (popup just opened)
    for (const el of root.querySelectorAll('[contenteditable="true"]')) {
      if (!el.offsetParent) continue;
      const r = el.getBoundingClientRect();
      // Bottom-right popups are typically near right edge of viewport
      if (r.width > 40 && r.height > 18) {
        return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), via: "any-ce"};
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
        if editor:
            print(f"  [dm] compose editor found via {editor.get('via', '?')} after {poll_i+1}s")
            break
        time.sleep(1)

    if not editor:
        screenshot("/tmp/li-dm-no-editor.png", full=False)
        fail("compose editor not found after clicking Message (waited 18s)", "/tmp/li-dm-no-editor.png")

    # Click into the editor to focus
    click(editor["x"], editor["y"])
    time.sleep(1)

    # Attach the file FIRST (if any) — easier to detect upload completion before typing
    attached = False
    if attachment_path:
        cdp("Page.setInterceptFileChooserDialog", enabled=True)
        drain_events()

        # Click attach button (paperclip). Two common locations: directly visible OR under "More" expander.
        attach_btn = js("""
(() => {
  function find(root) {
    if (!root || !root.querySelectorAll) return null;
    for (const el of root.querySelectorAll('button, [role="button"]')) {
      if (!el.offsetParent) continue;
      const lbl = (el.getAttribute('aria-label') || '').toLowerCase();
      const title = (el.getAttribute('title') || '').toLowerCase();
      if (lbl.includes('attach') || lbl.includes('paperclip') || lbl.includes('add a document') ||
          lbl.includes('attach a file') || title.includes('attach')) {
        const r = el.getBoundingClientRect();
        return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), label: lbl || title};
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
        if attach_btn:
            click(attach_btn["x"], attach_btn["y"])
            time.sleep(2)

            # Some panels show a sub-menu with "Attach a file" — click that if present
            sub = js("""
(() => {
  for (const el of document.querySelectorAll('button, [role="menuitem"], a')) {
    if (!el.offsetParent) continue;
    const t = (el.textContent || "").trim().toLowerCase();
    if (t === 'attach a file' || t === 'attach file' || t === 'add a document' || t === 'attach') {
      const r = el.getBoundingClientRect();
      return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)};
    }
  }
  return null;
})()
""")
            if sub:
                click(sub["x"], sub["y"])
                time.sleep(2)

            # Wait for fileChooserOpened
            chooser = None
            for _ in range(20):
                for ev in drain_events():
                    if ev.get("method") == "Page.fileChooserOpened":
                        chooser = ev.get("params", {})
                        break
                if chooser:
                    break
                time.sleep(0.5)

            if chooser and chooser.get("backendNodeId"):
                cdp("DOM.setFileInputFiles", files=[attachment_path], backendNodeId=chooser["backendNodeId"])
                time.sleep(4)
                attached = True
            else:
                # Couldn't intercept chooser. Try setting files on a visible <input type="file"> directly.
                set_via_input = js("""
((path) => {
  for (const el of document.querySelectorAll('input[type="file"]')) {
    // Just signal that an input exists; actual setFiles must go through CDP.
    return el.getAttribute('id') || '';
  }
  return null;
})(""" + json.dumps(attachment_path) + ")")
                # Skip the second-attempt path; we'll fall through to text-only
                attached = False
        else:
            print("  attach button not found; sending text-only")

    # Type the text message into the editor
    click(editor["x"], editor["y"])
    time.sleep(0.5)
    type_text(message)
    time.sleep(2)

    # Click Send. Buttons: usually <button> with text "Send" OR aria-label "Send".
    # We pick the visible Send that is NOT disabled.
    send = js("""
(() => {
  for (const el of document.querySelectorAll('button, [role="button"]')) {
    if (!el.offsetParent || el.disabled) continue;
    const t = (el.textContent || "").trim().toLowerCase();
    const lbl = (el.getAttribute('aria-label') || "").toLowerCase();
    if (t === 'send' || lbl === 'send' || lbl.startsWith('send message') || lbl.startsWith('send a message')) {
      const r = el.getBoundingClientRect();
      return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)};
    }
  }
  return null;
})()
""")

    if not send:
        screenshot("/tmp/li-dm-no-send.png", full=False)
        fail("Send button not found after typing message", "/tmp/li-dm-no-send.png")

    click(send["x"], send["y"])
    time.sleep(4)

    # Verify the editor cleared (typical post-send behavior)
    editor_empty = js("""
(() => {
  for (const el of document.querySelectorAll('[contenteditable="true"]')) {
    if (!el.offsetParent) continue;
    const t = (el.innerText || '').trim();
    if (t.length > 0) return false;
  }
  return true;
})()
""")

    shot = "/tmp/li-dm-after.png"
    try:
        screenshot(shot, full=False)
    except Exception:
        shot = None

    out = {
        "ok": True,
        "sentText": message,
        "attachmentName": attachment_name if attached else None,
        "attachedFile": attached,
        "editorClearedAfterSend": bool(editor_empty),
        "screenshotPath": shot,
    }
    with open(args_path, "w") as f:
        json.dump(out, f)
    print(json.dumps(out))
    return 0


main()
