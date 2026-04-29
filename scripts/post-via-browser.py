"""LinkedIn UI poster via browser-harness.

Args (env LI_POST_ARGS_PATH points to JSON file):
  {
    "text": "<post copy>",
    "attachmentPath": "/path/to/file.{mp4,png,jpg,pdf}" | null,
    "attachmentType": "image" | "video" | "document" | null,
    "dryRun": true | false   // if true, type+upload but don't click Post
  }

Result (overwrites the same JSON file):
  {"ok": true, "postUrl": "<url>", "activityId": "<id>", "screenshotPath": "..."}
  {"ok": false, "error": "<msg>", "screenshotPath": "..."}

Verified flow (2026-04-29):
  1. Switch to /feed tab (no goto if already there to avoid Leave-site dialog)
  2. Click "Start a post" (text "Start a post" — coord ~665,112 at 1440x900)
  3. Modal opens; toolbar at y=509:
     - Add media (image/video):     (564, 509) aria='Add media'
     - More expander:               (732, 509) aria='More'
     - After More: doc button:      (844, 509) aria='Add a document'
  4. For media: Page.setInterceptFileChooserDialog before click → click → fileChooserOpened
  5. DOM.setFileInputFiles with backendNodeId
  6. Wait for Next/Done; click it to return to composer
  7. Type post text into composer (auto-focused)
  8. Find Post button by textContent='Post', click
  9. Verify modal closed + page is /feed/

NOTE: Wrapped in main() so closures work under exec() (browser-harness runs scripts via exec).
"""
import json, os, sys, time


def main():
    ARGS_PATH = os.environ.get("LI_POST_ARGS_PATH")
    if not ARGS_PATH or not os.path.exists(ARGS_PATH):
        print(json.dumps({"ok": False, "error": f"args file missing: {ARGS_PATH}"}))
        return 1

    with open(ARGS_PATH) as f:
        args = json.load(f)

    post_text = (args.get("text") or "").strip()
    attachment_path = args.get("attachmentPath")
    attachment_type = args.get("attachmentType")
    dry_run = bool(args.get("dryRun"))

    def fail(msg, shot=None):
        out = {"ok": False, "error": msg}
        if shot:
            out["screenshotPath"] = shot
        with open(ARGS_PATH, "w") as f:
            json.dump(out, f)
        print(json.dumps(out))
        sys.exit(1)

    if not post_text:
        fail("empty post text")

    def find_button_by_text(text):
        expr = """
(() => {
  const T = %s;
  function find(root) {
    if (!root || !root.querySelectorAll) return null;
    for (const el of root.querySelectorAll('*')) {
      if (el.tagName === "BUTTON" && (el.textContent || "").trim() === T && el.offsetParent !== null) {
        const r = el.getBoundingClientRect();
        return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), disabled: !!el.disabled};
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
""" % json.dumps(text)
        return js(expr)

    # --- Setup: switch to feed tab ---
    tabs = list_tabs(include_chrome=False)
    feed = [t for t in tabs if t["url"].rstrip("/").endswith("linkedin.com/feed")]
    if not feed:
        new_tab("https://www.linkedin.com/feed/")
        wait_for_load()
        time.sleep(4)
        feed = [t for t in list_tabs(include_chrome=False) if t["url"].rstrip("/").endswith("linkedin.com/feed")]

    if not feed:
        fail("no /feed tab open and could not create one")

    target = feed[0]
    switch_tab(target["targetId"])
    time.sleep(1)
    cdp("Emulation.setDeviceMetricsOverride", width=1440, height=900, deviceScaleFactor=1, mobile=False)
    time.sleep(1)

    press_key("Escape"); time.sleep(0.3)
    press_key("Escape"); time.sleep(0.3)
    goto("https://www.linkedin.com/feed/")
    wait_for_load()
    time.sleep(5)

    cdp("Page.enable")

    # --- Open the post composer ---
    coords = js("""
(() => {
  const cands = Array.from(document.querySelectorAll('div, button, [role="button"]'))
    .filter(e => (e.textContent || "").trim() === "Start a post" && e.offsetParent !== null);
  if (!cands.length) return null;
  const r = cands[0].getBoundingClientRect();
  return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)};
})()
""")
    if not coords:
        screenshot("/tmp/li-no-share-box.png", full=False)
        fail("could not find 'Start a post' on feed", "/tmp/li-no-share-box.png")
    click(coords["x"], coords["y"])
    time.sleep(5)

    # --- Attach media (if requested) ---
    if attachment_path and attachment_type:
        if not os.path.exists(attachment_path):
            fail(f"attachment file not found: {attachment_path}")

        cdp("Page.setInterceptFileChooserDialog", enabled=True)
        drain_events()

        # Locate toolbar buttons dynamically (works on any viewport size).
        # Returns coords of: media (photo/video), more-expander, and after-expander add-document button.
        def find_modal_button(aria_substr_list):
            return js("""
((needles) => {
  function find(root) {
    if (!root || !root.querySelectorAll) return null;
    for (const el of root.querySelectorAll('button, [role="button"]')) {
      const lbl = (el.getAttribute('aria-label') || '').toLowerCase();
      const txt = (el.textContent || '').trim().toLowerCase();
      for (const n of needles) {
        if ((lbl.includes(n) || txt.includes(n)) && el.offsetParent !== null) {
          const r = el.getBoundingClientRect();
          return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), label: lbl || txt};
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
})(""" + repr(aria_substr_list) + ")")

        if attachment_type in ("image", "video"):
            btn = find_modal_button(["add a photo", "add a video", "add media"])
            if not btn:
                screenshot("/tmp/li-no-media-btn.png", full=False)
                fail("could not find media button in composer modal", "/tmp/li-no-media-btn.png")
            print(f"  [post] media button at ({btn['x']}, {btn['y']}) label={btn['label'][:40]}")
            click(btn["x"], btn["y"])
        elif attachment_type == "document":
            more = find_modal_button(["more", "open more options"])
            if not more:
                screenshot("/tmp/li-no-more-btn.png", full=False)
                fail("could not find 'More' expander in composer modal", "/tmp/li-no-more-btn.png")
            click(more["x"], more["y"])
            time.sleep(2)
            doc_btn = find_modal_button(["add a document", "share a document"])
            if not doc_btn:
                screenshot("/tmp/li-no-doc-btn.png", full=False)
                fail("could not find 'Add a document' in expander menu", "/tmp/li-no-doc-btn.png")
            click(doc_btn["x"], doc_btn["y"])
            time.sleep(3)
            choose = js("""
(() => {
  function find(root) {
    if (!root || !root.querySelectorAll) return null;
    for (const el of root.querySelectorAll('label')) {
      if ((el.textContent || "").trim() === "Choose file" && el.offsetParent !== null) {
        const r = el.getBoundingClientRect();
        return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)};
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
            if not choose:
                screenshot("/tmp/li-no-choose-file.png", full=False)
                fail("'Choose file' LABEL not found in document sub-modal", "/tmp/li-no-choose-file.png")
            click(choose["x"], choose["y"])
        else:
            fail(f"unsupported attachmentType: {attachment_type}")
        time.sleep(2)

        chooser = None
        for _ in range(30):
            for ev in drain_events():
                if ev.get("method") == "Page.fileChooserOpened":
                    chooser = ev.get("params", {})
                    break
            if chooser:
                break
            time.sleep(0.5)

        if not chooser:
            screenshot("/tmp/li-no-chooser.png", full=False)
            fail("file chooser dialog never opened after media click", "/tmp/li-no-chooser.png")

        backend_node_id = chooser.get("backendNodeId")
        if not backend_node_id:
            fail(f"fileChooserOpened missing backendNodeId: {chooser}")

        cdp("DOM.setFileInputFiles", files=[attachment_path], backendNodeId=backend_node_id)
        time.sleep(3)

        # Documents require a title before Done is enabled.
        if attachment_type == "document":
            # Wait for the upload to render (title input appears)
            for _ in range(30):
                title_input = js("""
(() => {
  function find(root) {
    if (!root || !root.querySelectorAll) return null;
    for (const el of root.querySelectorAll('input[type="text"], textarea')) {
      const ph = (el.getAttribute('placeholder') || '').toLowerCase();
      if (ph.includes('title') && el.offsetParent !== null) {
        const r = el.getBoundingClientRect();
        return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)};
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
                if title_input:
                    break
                time.sleep(1)
            if title_input:
                doc_title = (post_text.split("\n")[0])[:80] or "Document"
                click(title_input["x"], title_input["y"])
                time.sleep(0.5)
                type_text(doc_title)
                time.sleep(1)

        upload_max = 120 if attachment_type == "video" else 60
        advanced = False
        for _ in range(upload_max):
            nxt = find_button_by_text("Next")
            done = find_button_by_text("Done")
            if nxt and not nxt["disabled"]:
                click(nxt["x"], nxt["y"])
                advanced = True
                break
            if done and not done["disabled"]:
                click(done["x"], done["y"])
                advanced = True
                break
            time.sleep(1)

        if not advanced:
            screenshot("/tmp/li-upload-stuck.png", full=False)
            fail(f"upload didn't complete in {upload_max}s (no Next/Done enabled)", "/tmp/li-upload-stuck.png")

        time.sleep(3)

    # --- Type post text ---
    # Editor is auto-focused after opening composer / clicking Next on media.
    # Verify modal is actually open by checking for the Post button first.
    pre_post_btn = find_button_by_text("Post")
    if not pre_post_btn:
        screenshot("/tmp/li-modal-not-open.png", full=False)
        fail("Post button missing — modal not open before typing", "/tmp/li-modal-not-open.png")
    type_text(post_text)
    time.sleep(3)

    screenshot("/tmp/li-pre-submit.png", full=False)

    post_btn = find_button_by_text("Post")
    if not post_btn:
        fail("Post button not found after typing", "/tmp/li-pre-submit.png")
    if post_btn["disabled"]:
        fail(f"Post button is disabled (text len={len(post_text)})", "/tmp/li-pre-submit.png")

    if dry_run:
        out = {"ok": True, "dryRun": True, "screenshotPath": "/tmp/li-pre-submit.png"}
        with open(ARGS_PATH, "w") as f:
            json.dump(out, f)
        print(json.dumps(out))
        return 0

    print(f"CLICKING POST at ({post_btn['x']},{post_btn['y']})", flush=True)
    click(post_btn["x"], post_btn["y"])
    print("POST CLICKED, sleeping 5s", flush=True)
    time.sleep(5)
    print("WRITING SUCCESS RESULT (early)", flush=True)
    # Write result EARLY in case anything below hangs
    early_out = {"ok": True, "postClicked": True, "screenshotPath": "/tmp/li-pre-submit.png"}
    with open(ARGS_PATH, "w") as f:
        json.dump(early_out, f)
    print("EARLY RESULT WRITTEN", flush=True)

    # Best-effort screenshot. If page is mid-navigation it can hang Page.captureScreenshot.
    try:
        screenshot("/tmp/li-post-submitted.png", full=False)
        print("post-submit screenshot taken", flush=True)
    except Exception as e:
        print(f"screenshot warning: {e}", flush=True)

    # Best-effort URL/activity extraction with short timeout per call.
    post_url = ""
    activity = None
    try:
        info = page_info()
        post_url = info.get("url", "")
    except Exception:
        pass
    try:
        activity = js("""
(() => {
  const links = Array.from(document.querySelectorAll('a[href*="/feed/update/urn:li:activity:"]'));
  if (!links.length) return null;
  const m = links[0].href.match(/urn:li:activity:(\\d+)/);
  return m ? m[1] : null;
})()
""")
    except Exception:
        pass

    out = {
        "ok": True,
        "postUrl": post_url,
        "activityId": activity,
        "screenshotPath": "/tmp/li-post-submitted.png",
    }
    with open(ARGS_PATH, "w") as f:
        json.dump(out, f)
    print(json.dumps(out))
    return 0


main()
