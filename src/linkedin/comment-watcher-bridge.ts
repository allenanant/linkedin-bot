/**
 * TypeScript bridge to the browser-harness comment-watcher scripts.
 *
 * Each function spawns the python script via browser-harness, passing args
 * through a temp JSON file (LI_*_ARGS_PATH env), and reads the result back
 * from the same file once the script writes to it.
 *
 * Mirrors the pattern from src/linkedin/post-via-browser.ts.
 */
import { spawn } from "child_process";
import { writeFileSync, readFileSync, mkdtempSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const SCRIPTS_DIR = process.env.LI_SCRIPTS_DIR || join(__dirname, "..", "..", "scripts");
const BROWSER_HARNESS = process.env.BROWSER_HARNESS_BIN
  || `${process.env.HOME}/.local/bin/browser-harness`;
const BU_NAME = process.env.LI_BU_NAME || "linkedin";

export type ScrapedComment = {
  commentUrn: string | null;
  profileUrl: string;
  name: string | null;
  text: string;
};

export type ScrapeCommentsResult = {
  ok: boolean;
  error?: string;
  activityId?: string;
  url?: string;
  expandClicks?: number;
  count?: number;
  totalRaw?: number;
  comments?: ScrapedComment[];
  screenshotPath?: string;
};

export type ConnectionStatus = "connected" | "not_connected" | "pending" | "self" | "unknown";

export type CheckConnectionResult = {
  ok: boolean;
  error?: string;
  profileUrl?: string;
  status?: ConnectionStatus;
  evidence?: string;
  screenshotPath?: string;
};

export type ReplyResult = {
  ok: boolean;
  error?: string;
  postedText?: string;
  screenshotPath?: string;
};

export type AcceptConnectionsResult = {
  ok: boolean;
  error?: string;
  acceptedProfileUrls?: string[];
  inspectedCount?: number;
  screenshotPath?: string;
};

export type DmResult = {
  ok: boolean;
  error?: string;
  sentText?: string;
  attachmentName?: string;
  screenshotPath?: string;
};

interface RunOpts {
  scriptName: string;
  envName: string;
  args: any;
  resultLabel: string;
}

async function runHarness<T>(opts: RunOpts): Promise<T> {
  const tmp = mkdtempSync(join(tmpdir(), `li-${opts.envName.toLowerCase()}-`));
  const argsPath = join(tmp, "args.json");
  writeFileSync(argsPath, JSON.stringify(opts.args));
  const scriptPath = join(SCRIPTS_DIR, opts.scriptName);
  const scriptSrc = readFileSync(scriptPath, "utf8");

  const env = {
    ...process.env,
    [opts.envName]: argsPath,
    BU_NAME,
    PATH: `${process.env.HOME}/.local/bin:${process.env.PATH || ""}`,
  };

  return new Promise<T>((resolve) => {
    const child = spawn(BROWSER_HARNESS, [], { env });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (b) => stdoutChunks.push(b));
    child.stderr.on("data", (b) => stderrChunks.push(b));

    child.on("error", (err) => {
      cleanup();
      resolve({ ok: false, error: `spawn failed: ${err.message}` } as any);
    });

    child.on("close", (code) => {
      let result: any;
      try {
        result = JSON.parse(readFileSync(argsPath, "utf8"));
      } catch (e) {
        const stdout = Buffer.concat(stdoutChunks).toString();
        const stderr = Buffer.concat(stderrChunks).toString();
        result = {
          ok: false,
          error: `${opts.resultLabel} script exited code ${code}; stdout=${stdout.slice(-400)} stderr=${stderr.slice(-400)}`,
        };
      }
      cleanup();
      resolve(result as T);
    });

    child.stdin.write(scriptSrc);
    child.stdin.end();

    function cleanup() {
      try { unlinkSync(argsPath); } catch {}
    }
  });
}

export async function scrapeComments(activityId: string, maxExpand = 20): Promise<ScrapeCommentsResult> {
  return runHarness<ScrapeCommentsResult>({
    scriptName: "scrape-comments.py",
    envName: "LI_SCRAPE_ARGS_PATH",
    args: { activityId, maxExpand },
    resultLabel: "scrape-comments",
  });
}

export async function checkConnectionStatus(profileUrl: string): Promise<CheckConnectionResult> {
  return runHarness<CheckConnectionResult>({
    scriptName: "check-connection.py",
    envName: "LI_CHECK_CONN_ARGS_PATH",
    args: { profileUrl },
    resultLabel: "check-connection",
  });
}

export async function replyToComment(args: {
  activityId: string;
  commentUrn?: string | null;
  commenterProfileUrl: string;
  replyText: string;
}): Promise<ReplyResult> {
  return runHarness<ReplyResult>({
    scriptName: "reply-to-comment.py",
    envName: "LI_REPLY_ARGS_PATH",
    args,
    resultLabel: "reply-to-comment",
  });
}

export async function acceptConnections(profileUrls: string[]): Promise<AcceptConnectionsResult> {
  return runHarness<AcceptConnectionsResult>({
    scriptName: "accept-connections.py",
    envName: "LI_ACCEPT_ARGS_PATH",
    args: { profileUrls },
    resultLabel: "accept-connections",
  });
}

export async function sendDm(args: {
  profileUrl: string;
  message: string;
  attachmentPath?: string;
  attachmentName?: string;
}): Promise<DmResult> {
  return runHarness<DmResult>({
    scriptName: "dm-with-pdf.py",
    envName: "LI_DM_ARGS_PATH",
    args,
    resultLabel: "dm-with-pdf",
  });
}
