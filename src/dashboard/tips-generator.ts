import cron from "node-cron";
import { execFileSync } from "child_process";
import {
  getPostCounts,
  saveDailyTip,
} from "../storage/db";

export async function generateDailyTip(): Promise<void> {
  try {
    const counts = await getPostCounts();

    const prompt = `You are a LinkedIn content strategist. Based on these posting stats, give ONE short (2-3 sentences) actionable insight to improve LinkedIn engagement.

Posting stats:
- Total posts: ${counts.postCount}
- Image posts: ${counts.imagePostCount}
- Text posts: ${counts.textPostCount}

Give ONE specific, actionable tip about content strategy, posting frequency, or content types. Be concise and direct.`;

    const result = execFileSync(
      "claude",
      ["-p", "--model", "haiku", "--output-format", "text"],
      {
        input: prompt,
        encoding: "utf-8",
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      }
    );
    const tipContent = result.trim();

    const snapshot = { counts };
    await saveDailyTip(tipContent, snapshot);

    console.log("[Tips] Daily tip generated successfully");
  } catch (err) {
    console.error("[Tips] Failed to generate daily tip:", err);
  }
}

export function scheduleTipGeneration(): void {
  // Run at 00:30 UTC daily
  cron.schedule("30 0 * * *", () => {
    console.log("[Tips] Running scheduled tip generation...");
    generateDailyTip();
  });
  console.log("[Tips] Tip generation scheduled for 00:30 UTC daily");
}
