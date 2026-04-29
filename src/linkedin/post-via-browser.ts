import { spawn } from "child_process";
import { writeFileSync, readFileSync, mkdtempSync, writeFile, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Post to LinkedIn via the browser UI (browser-harness on port 9222).
 *
 * Why UI not API: posts created through the LinkedIn web UI get more
 * algorithmic reach than API-published posts. Anecdotal but consistent
 * across the agency-content community.
 *
 * Requires:
 *  - browser-harness installed at $HOME/.local/bin/browser-harness
 *  - Chrome 9222 with LinkedIn logged-in profile (chrome-bu-profile)
 *  - scripts/post-via-browser.py present in linkedin-bot repo
 */
export interface PostViaBrowserOptions {
  text: string;
  attachment?: {
    type: "image" | "video" | "document";
    /**
     * Either a filesystem path (preferred) or in-memory bytes.
     * If `data` is provided, we write a temp file before invoking the script.
     */
    path?: string;
    data?: Buffer;
    /** Required when `data` is given. Used for the temp file extension. */
    extension?: "mp4" | "png" | "jpg" | "pdf";
  };
  dryRun?: boolean;
}

export interface PostViaBrowserResult {
  ok: boolean;
  error?: string;
  postUrl?: string;
  activityId?: string | null;
  screenshotPath?: string;
  dryRun?: boolean;
  postClicked?: boolean;
}

const SCRIPT_PATH = process.env.LI_POST_SCRIPT
  || join(__dirname, "..", "..", "scripts", "post-via-browser.py");
const BROWSER_HARNESS = process.env.BROWSER_HARNESS_BIN
  || `${process.env.HOME}/.local/bin/browser-harness`;
const BU_NAME = process.env.LI_BU_NAME || "linkedin";

export async function postViaBrowser(opts: PostViaBrowserOptions): Promise<PostViaBrowserResult> {
  const tmp = mkdtempSync(join(tmpdir(), "li-post-"));
  const argsPath = join(tmp, "args.json");

  let attachmentPath: string | undefined;
  let attachmentTempFile: string | undefined;

  if (opts.attachment) {
    if (opts.attachment.path) {
      attachmentPath = opts.attachment.path;
    } else if (opts.attachment.data) {
      const ext = opts.attachment.extension || (
        opts.attachment.type === "video" ? "mp4"
          : opts.attachment.type === "document" ? "pdf"
          : "png"
      );
      attachmentTempFile = join(tmp, `attachment.${ext}`);
      writeFileSync(attachmentTempFile, opts.attachment.data);
      attachmentPath = attachmentTempFile;
    }
  }

  const argsJson = {
    text: opts.text,
    attachmentPath: attachmentPath || null,
    attachmentType: opts.attachment?.type || null,
    dryRun: !!opts.dryRun,
  };
  writeFileSync(argsPath, JSON.stringify(argsJson));

  // Spawn browser-harness with stdin = post-via-browser.py
  const env = {
    ...process.env,
    LI_POST_ARGS_PATH: argsPath,
    BU_NAME,
    PATH: `${process.env.HOME}/.local/bin:${process.env.PATH || ""}`,
  };

  const scriptSrc = readFileSync(SCRIPT_PATH, "utf8");

  return new Promise((resolve) => {
    const child = spawn(BROWSER_HARNESS, [], { env });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (b) => stdoutChunks.push(b));
    child.stderr.on("data", (b) => stderrChunks.push(b));

    child.on("error", (err) => {
      cleanup();
      resolve({ ok: false, error: `spawn failed: ${err.message}` });
    });

    child.on("close", (code) => {
      let result: PostViaBrowserResult;
      try {
        result = JSON.parse(readFileSync(argsPath, "utf8"));
      } catch (e) {
        const stdout = Buffer.concat(stdoutChunks).toString();
        const stderr = Buffer.concat(stderrChunks).toString();
        result = {
          ok: false,
          error: `script exited with code ${code}; could not parse result. stdout: ${stdout.slice(-500)} stderr: ${stderr.slice(-500)}`,
        };
      }
      cleanup();
      resolve(result);
    });

    child.stdin.write(scriptSrc);
    child.stdin.end();

    function cleanup() {
      try { unlinkSync(argsPath); } catch {}
      if (attachmentTempFile) {
        try { unlinkSync(attachmentTempFile); } catch {}
      }
    }
  });
}

/**
 * Convenience wrappers matching the API-side function signatures so that
 * interaction-server.ts can call either path with minimal branching.
 *
 * Returns `{ linkedinPostId, activityId }`:
 *   - linkedinPostId: legacy field stored in posts.linkedin_post_id (activity id, post url, or "ok")
 *   - activityId: numeric LinkedIn activity id when extractable (used by comment watcher)
 */
export type BrowserPostResult = { linkedinPostId: string; activityId: string | null };

function unwrap(result: PostViaBrowserResult, errLabel: string): BrowserPostResult {
  if (!result.ok) throw new Error(result.error || errLabel);
  return {
    linkedinPostId: result.activityId || result.postUrl || "ok",
    activityId: result.activityId || null,
  };
}

export async function createTextPostViaBrowser(text: string): Promise<BrowserPostResult> {
  return unwrap(await postViaBrowser({ text }), "browser post failed");
}

export async function createImagePostViaBrowser(
  text: string,
  imageData: Buffer,
): Promise<BrowserPostResult> {
  return unwrap(
    await postViaBrowser({ text, attachment: { type: "image", data: imageData, extension: "png" } }),
    "browser image post failed"
  );
}

export async function createVideoPostViaBrowser(
  text: string,
  videoData: Buffer,
): Promise<BrowserPostResult> {
  return unwrap(
    await postViaBrowser({ text, attachment: { type: "video", data: videoData, extension: "mp4" } }),
    "browser video post failed"
  );
}

export async function createDocumentPostViaBrowser(
  text: string,
  pdfData: Buffer,
): Promise<BrowserPostResult> {
  return unwrap(
    await postViaBrowser({ text, attachment: { type: "document", data: pdfData, extension: "pdf" } }),
    "browser document post failed"
  );
}
