// Generate a video for an existing sample post + post it live to LinkedIn via browser-harness.
// No DB. No Slack. Direct path: read JSON → render video → post via UI → done.
//
// Usage:
//   npx tsx scripts/post-sample-live.ts <sample-label>
// Example:
//   npx tsx scripts/post-sample-live.ts opus47
// Reads:
//   out/sample-<label>.json
// Posts:
//   the post content with the rendered MP4

import fs from "fs";
import path from "path";
import { generateLinkedInVideo } from "../src/content/video-generator";
import { createVideoPostViaBrowser } from "../src/linkedin/post-via-browser";

async function main() {
  const label = process.argv[2];
  if (!label) {
    console.error("Usage: npx tsx scripts/post-sample-live.ts <label>");
    process.exit(1);
  }

  const samplePath = path.resolve(__dirname, "..", "out", `sample-${label}.json`);
  if (!fs.existsSync(samplePath)) {
    console.error(`Sample file not found: ${samplePath}`);
    process.exit(1);
  }
  const sample = JSON.parse(fs.readFileSync(samplePath, "utf-8"));
  console.log(`Loaded sample "${label}". Topic: ${sample.topic.slice(0, 80)}`);
  console.log(`Voice mode: ${sample.voiceMode}, CTA: ${sample.ctaKeyword || "(none)"}`);

  console.log("\n========= POST CONTENT =========\n");
  console.log(sample.content);
  console.log("\n================================\n");

  console.log("Generating video via linkedin-videos designer + Remotion...");
  const video = await generateLinkedInVideo(sample.content);
  console.log(`Video ready: ${video.buffer.length} bytes, ${video.durationSec.toFixed(1)}s, designer attempts: ${video.attempts}`);
  console.log(`MP4 path: ${video.mp4Path}`);

  console.log("\nPosting to LinkedIn via browser-harness...");
  const linkedinPostId = await createVideoPostViaBrowser(sample.content, video.buffer);
  console.log(`\n✓ Posted to LinkedIn. Activity ID: ${linkedinPostId || "(not captured)"}`);
  console.log(`  Profile: https://www.linkedin.com/in/allen-anant-thomas/recent-activity/all/`);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
