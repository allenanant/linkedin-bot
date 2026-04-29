import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const VIDEO_REPO =
  process.env.LINKEDIN_VIDEO_REPO ||
  path.resolve(__dirname, "..", "..", "..", "linkedin-videos");

const TS_NODE_PROJECT = "tsconfig.designer.json";

export interface GeneratedVideo {
  buffer: Buffer;
  mp4Path: string;
  planPath: string;
  totalFrames: number;
  durationSec: number;
  attempts: number;
  renderMs: number;
}

interface GeneratorStdout {
  mp4: string;
  plan: string;
  attempts: number;
  totalFrames: number;
  durationSec: number;
  renderMs: number;
}

function parseGeneratorStdout(stdout: string): GeneratorStdout {
  const lines = stdout.split(/\r?\n/);
  let mp4 = "";
  let plan = "";
  let attempts = 0;
  let totalFrames = 0;
  let durationSec = 0;
  let renderMs = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("MP4: ")) mp4 = trimmed.slice(5).trim();
    else if (trimmed.startsWith("Plan: ")) plan = trimmed.slice(6).trim();
    else if (trimmed.startsWith("Designer attempts: ")) attempts = Number(trimmed.slice(19));
    else if (trimmed.startsWith("Duration: ")) {
      const m = trimmed.match(/Duration:\s+([\d.]+)s\s+\((\d+)\s+frames\)/);
      if (m) {
        durationSec = Number(m[1]);
        totalFrames = Number(m[2]);
      }
    } else if (trimmed.startsWith("Render time: ")) {
      const m = trimmed.match(/Render time:\s+([\d.]+)s/);
      if (m) renderMs = Number(m[1]) * 1000;
    }
  }
  if (!mp4) throw new Error(`generator did not emit MP4 path. Output:\n${stdout}`);
  return { mp4, plan, attempts, totalFrames, durationSec, renderMs };
}

export async function generateLinkedInVideo(postText: string): Promise<GeneratedVideo> {
  if (!fs.existsSync(VIDEO_REPO)) {
    throw new Error(
      `linkedin-videos repo not found at ${VIDEO_REPO}. Set LINKEDIN_VIDEO_REPO env var.`
    );
  }

  const args = [
    "ts-node",
    "--project",
    TS_NODE_PROJECT,
    "src/generator/index.ts",
    postText,
  ];

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn("npx", args, {
      cwd: VIDEO_REPO,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk.toString()));
    child.stderr.on("data", (chunk) => (err += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(`video generator exited ${code}.\nstderr:\n${err}\nstdout:\n${out}`)
        );
      } else {
        resolve(out);
      }
    });
  });

  const meta = parseGeneratorStdout(stdout);
  const buffer = fs.readFileSync(meta.mp4);

  return {
    buffer,
    mp4Path: meta.mp4,
    planPath: meta.plan,
    totalFrames: meta.totalFrames,
    durationSec: meta.durationSec,
    attempts: meta.attempts,
    renderMs: meta.renderMs,
  };
}
