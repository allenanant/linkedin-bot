"""Reply to a specific comment on a LinkedIn post.

Args (env LI_REPLY_ARGS_PATH points to JSON file):
  {
    "activityId": "7455224531927027713",
    "commentUrn": "urn:li:comment:(...)" | null,   // preferred locator
    "commenterProfileUrl": "https://www.linkedin.com/in/foo-bar/",  // fallback locator
    "replyText": "the paraphrased reply body"
  }

Result (overwrites the same JSON file):
  {"ok": true, "postedText": "...", "screenshotPath": "..."}
  {"ok": false, "error": "...", "screenshotPath": "..."}

Strategy:
  1. Navigate to /feed/update/urn:li:activity:<id>/
  2. Expand comments until target appears (cap)
  3. Locate target comment element by commentUrn (preferred) or commenter profile URL
  4. Click the "Reply" button inside that comment's action row
  5. Type the reply into the focused editor
  6. Click the "Reply" submit button (NOT the post-level "Post"/"Comment" button)
  7. Verify the reply appears
"""
import json, os, sys, time


def main():
    args_path = os.environ.get("LI_REPLY_ARGS_PATH")
    if not args_path or not os.path.exists(args_path):
        print(json.dumps({"ok": False, "error": f"args file missing: {args_path}"}))
        return 1

    with open(args_path) as f:
        args = json.load(f)

    activity_id = (args.get("activityId") or "").strip()
    comment_urn = args.get("commentUrn")
    profile_url = (args.get("commenterProfileUrl") or "").strip()
    reply_text = (args.get("replyText") or "").strip()

    def fail(msg, shot=None):
        out = {"ok": False, "error": msg}
        if shot:
            out["screenshotPath"] = shot
        with open(args_path, "w") as f:
            json.dump(out, f)
        print(json.dumps(out))
        sys.exit(1)

    if not activity_id:
        fail("missing activityId")
    if not reply_text:
        fail("missing replyText")
    if not comment_urn and not profile_url:
        fail("need either commentUrn or commenterProfileUrl")

    url = f"https://www.linkedin.com/feed/update/urn:li:activity:{activity_id}/"

    # Switch to /feed tab
    tabs = list_tabs(include_chrome=False)
    feed = [t for t in tabs if "linkedin.com" in t["url"]]
    if feed:
        switch_tab(feed[0]["targetId"])
    else:
        new_tab("https://www.linkedin.com/feed/")
        wait_for_load()
        time.sleep(3)

    cdp("Emulation.setDeviceMetricsOverride", width=1440, height=2200, deviceScaleFactor=1, mobile=False)
    time.sleep(0.5)

    press_key("Escape"); time.sleep(0.2)
    goto(url)
    wait_for_load()
    time.sleep(5)

    # Scroll into the comments region
    js("""window.scrollTo(0, Math.max(400, document.body.scrollHeight * 0.4))""")
    time.sleep(2)

    # Helper that locates the target comment, scrolls it into view, and returns coords of its Reply button.
    def find_reply_button():
        return js("""
((commentUrn, profileFragment) => {
  function visibleRect(el) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)};
  }
  function findContainer() {
    // First by commentUrn data-id
    if (commentUrn) {
      const a = document.querySelector('[data-id="' + commentUrn + '"]');
      if (a) return a;
    }
    // Fallback by commenter profile URL
    if (profileFragment) {
      const links = Array.from(document.querySelectorAll('a[href*="' + profileFragment + '"]'));
      for (const l of links) {
        // Walk up to the closest comment-ish container
        let n = l;
        for (let i = 0; i < 12 && n; i++) {
          if (n.getAttribute && n.getAttribute('data-id') && n.getAttribute('data-id').startsWith('urn:li:comment:')) return n;
          if (n.tagName === 'ARTICLE' && /comment/i.test(n.className || '')) return n;
          n = n.parentElement;
        }
      }
    }
    return null;
  }
  const container = findContainer();
  if (!container) return null;
  container.scrollIntoView({block: "center"});
  // Find Reply button within this container — text is 'Reply'
  const buttons = Array.from(container.querySelectorAll('button, [role="button"]'));
  for (const b of buttons) {
    const t = (b.textContent || "").trim().toLowerCase();
    if (t === 'reply') {
      const r = visibleRect(b);
      if (r) return r;
    }
  }
  return null;
})(""" + json.dumps(comment_urn) + ", " + json.dumps(profile_url) + ")")

    # Try expand-and-find loop. Expand "Show more comments" until we either find the
    # comment or run out of expansions.
    found = None
    for attempt in range(20):
        found = find_reply_button()
        if found:
            break
        # Try expanding more comments
        btn = js("""
(() => {
  const txts = ["load more comments", "view more comments", "view previous comments",
                "show more comments", "show more replies", "load previous"];
  for (const el of document.querySelectorAll('button, [role="button"]')) {
    const t = (el.textContent || "").trim().toLowerCase();
    const lbl = (el.getAttribute('aria-label') || "").toLowerCase();
    for (const needle of txts) {
      if ((t.includes(needle) || lbl.includes(needle)) && el.offsetParent !== null && !el.disabled) {
        el.scrollIntoView({block: "center"});
        const r = el.getBoundingClientRect();
        return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)};
      }
    }
  }
  return null;
})()
""")
        if not btn:
            break
        click(btn["x"], btn["y"])
        time.sleep(2)

    if not found:
        screenshot("/tmp/li-reply-not-found.png", full=False)
        fail("could not locate target comment to reply to", "/tmp/li-reply-not-found.png")

    # Click the Reply button to open the inline reply editor
    click(found["x"], found["y"])
    time.sleep(2)

    # The editor is a contenteditable div that auto-focuses. Type the reply.
    type_text(reply_text)
    time.sleep(2)

    # Submit via Ctrl+Enter — LinkedIn's standard keyboard shortcut for the inline
    # comment/reply editor. Avoids the cross-post collision risk of finding "Reply"
    # buttons elsewhere on the page (which previously sent a reply to the wrong post).
    press_key("Enter", modifiers=["Control"])
    time.sleep(3)

    # Belt-and-suspenders: if Ctrl+Enter didn't work, the editor still has text in it.
    # In that case, scope the submit-button search to the SAME comment container as
    # the Reply button we clicked. Never fall through to a global button search.
    editor_still_open = js("""
((needle) => {
  for (const el of document.querySelectorAll('[contenteditable="true"]')) {
    if (!el.offsetParent) continue;
    const t = (el.innerText || el.textContent || "").trim();
    if (t.toLowerCase().includes((needle || "").toLowerCase().slice(0, 40))) return true;
  }
  return false;
})(""" + json.dumps(reply_text) + ")")

    if editor_still_open:
        # Find the editor → walk up to its closest comment ancestor → find its inline
        # Submit button (a "Reply" or "Submit" button within the SAME container).
        submit = js("""
((needle) => {
  function inlineSubmit(editor) {
    let n = editor;
    for (let i = 0; i < 14 && n; i++) {
      // Look for buttons that are siblings/children of the editor's wrapper
      const buttons = n.querySelectorAll ? n.querySelectorAll('button, [role="button"]') : [];
      for (const b of buttons) {
        if (!b.offsetParent || b.disabled) continue;
        const t = (b.textContent || "").trim().toLowerCase();
        const lbl = (b.getAttribute('aria-label') || "").toLowerCase();
        if (t === 'reply' || t === 'submit' || t === 'post' || lbl === 'reply' || lbl === 'submit') {
          // Confirm the button is positioned NEAR the editor (within 200px below)
          const er = editor.getBoundingClientRect();
          const br = b.getBoundingClientRect();
          if (br.y >= er.y - 20 && br.y <= er.y + er.height + 200) {
            return {x: Math.round(br.x + br.width/2), y: Math.round(br.y + br.height/2)};
          }
        }
      }
      n = n.parentElement;
    }
    return null;
  }
  for (const el of document.querySelectorAll('[contenteditable="true"]')) {
    if (!el.offsetParent) continue;
    const t = (el.innerText || el.textContent || "").trim();
    if (t.toLowerCase().includes((needle || "").toLowerCase().slice(0, 40))) {
      return inlineSubmit(el);
    }
  }
  return null;
})(""" + json.dumps(reply_text) + ")")

        if not submit:
            screenshot("/tmp/li-reply-no-submit.png", full=False)
            fail("Reply did not submit via Ctrl+Enter and no scoped submit button found", "/tmp/li-reply-no-submit.png")
        click(submit["x"], submit["y"])
        time.sleep(3)

    # Verify the reply landed by searching the page for the reply text
    found_text = js("""
((needle) => {
  if (!needle) return false;
  const all = (document.body.innerText || "").toLowerCase();
  return all.includes(needle.toLowerCase().slice(0, Math.min(60, needle.length)));
})(""" + json.dumps(reply_text) + ")")

    shot = "/tmp/li-reply-after.png"
    try:
        screenshot(shot, full=False)
    except Exception:
        shot = None

    out = {
        "ok": bool(found_text),
        "postedText": reply_text if found_text else None,
        "screenshotPath": shot,
    }
    if not found_text:
        out["error"] = "reply text not visible after submit (possible failure)"
    with open(args_path, "w") as f:
        json.dump(out, f)
    print(json.dumps(out))
    return 0


main()
