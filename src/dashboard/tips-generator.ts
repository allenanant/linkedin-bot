import cron from "node-cron";
import { execFileSync } from "child_process";
import {
  getAggregateAnalytics,
  getWeeklyComparison,
  saveDailyTip,
} from "../storage/db";

export async function generateDailyTip(): Promise<void> {
  try {
    const [thisWeek, changes] = await Promise.all([
      getAggregateAnalytics(7),
      getWeeklyComparison(),
    ]);

    const prompt = `You are a LinkedIn content strategist. Analyze these weekly metrics and give ONE short (2-3 sentences) actionable insight to improve LinkedIn engagement.

This week's metrics:
- Posts: ${thisWeek.postCount}
- Likes: ${thisWeek.totalLikes}
- Comments: ${thisWeek.totalComments}
- Shares: ${thisWeek.totalShares}
- Impressions: ${thisWeek.totalImpressions}
- Image posts: ${thisWeek.imagePostCount}, Text posts: ${thisWeek.textPostCount}

Week-over-week changes:
- Likes: ${changes.likesChange}%
- Comments: ${changes.commentsChange}%
- Shares: ${changes.sharesChange}%
- Impressions: ${changes.impressionsChange}%

Give ONE specific, actionable tip based on these numbers. Be concise and direct.`;

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

    const snapshot = { thisWeek, changes };
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
