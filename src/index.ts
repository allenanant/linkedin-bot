import { config } from "./config";
import { generateLinkedInPost } from "./content/generator";
import { generateCarousel } from "./content/carousel-generator";
import { generateLinkedInVideo } from "./content/video-generator";
import { initDb, savePost } from "./storage/db";
import { scheduleDailyJobs, scheduleIntervalJob } from "./scheduler/cron";
import { notifyPipelineError } from "./notifications/slack";
import { sendDraftToSlack } from "./slack/send-draft";
import { runResearch } from "./pipeline/research";
import { runCommentWatcherOnce } from "./comment-watcher/orchestrator";

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

type PostFormat = "video" | "carousel";

async function generateOnePost(
  research: any,
  index: number,
  total: number,
  postFormat: PostFormat
): Promise<void> {
  log(`--- Generating post ${index}/${total} (${postFormat}) ---`);

  const generated = await generateLinkedInPost(research, false, "freebie", postFormat);
  log(`Post ${index}: topic = ${generated.topic.slice(0, 80)}`);

  let pdfBuffer: Buffer | null = null;
  let videoBuffer: Buffer | null = null;
  let videoPath: string | null = null;
  let postType = "text";

  if (postFormat === "video") {
    try {
      const video = await generateLinkedInVideo(generated.content);
      videoBuffer = video.buffer;
      videoPath = video.mp4Path;
      postType = "video";
      log(
        `Post ${index}: video generated (${videoBuffer.length} bytes, ${video.durationSec.toFixed(1)}s, designer attempts: ${video.attempts})`
      );
    } catch (err: any) {
      log(`Post ${index}: video generation failed (${err.message}). Saving as text-only.`);
    }
  } else {
    try {
      pdfBuffer = await generateCarousel(generated.content, generated.topic);
      postType = "carousel";
      log(`Post ${index}: carousel PDF generated (${pdfBuffer.length} bytes)`);
    } catch (err: any) {
      log(`Post ${index}: carousel failed (${err.message}). Saving as text-only.`);
    }
  }

  const postId = await savePost({
    content: generated.content,
    researchData: JSON.stringify(research),
    status: "draft",
    pdfData: pdfBuffer || undefined,
    videoData: videoBuffer || undefined,
    videoPath: videoPath || undefined,
    postType,
    ctaKeyword: generated.ctaKeyword || undefined,
    leadMagnetTitle: generated.leadMagnetTitle || undefined,
    voiceMode: generated.voiceMode,
    topic: generated.topic,
  });
  log(`Post ${index}: saved as draft #${postId}`);

  await sendDraftToSlack({
    id: postId,
    content: generated.content,
    topic: generated.topic,
    pdfData: pdfBuffer,
    videoData: videoBuffer,
    postType,
    batchIndex: index,
    batchTotal: total,
  });
}

async function runDailyBatch() {
  log("=== Starting daily LinkedIn batch ===");

  await initDb();

  const slots: PostFormat[] = ["video", "carousel"];

  try {
    log("Running research...");
    const research = await runResearch();
    log("Research complete.");

    for (let i = 0; i < slots.length; i++) {
      try {
        await generateOnePost(research, i + 1, slots.length, slots[i]);
      } catch (err: any) {
        log(`Post ${i + 1}/${slots.length} (${slots[i]}) failed: ${err.message}`);
      }
    }

    log("=== Daily batch complete ===");
  } catch (err: any) {
    log(`BATCH ERROR: ${err.message}`);
    console.error(err);
    await notifyPipelineError(err.message);
  }
}

// CLI entry points
const command = process.argv[2];

switch (command) {
  case "run":
    runDailyBatch();
    break;
  case "research":
    initDb().then(() => runResearch()).then((r) => console.log(JSON.stringify(r, null, 2)));
    break;
  case "generate":
    initDb().then(() => runResearch())
      .then((r) => generateLinkedInPost(r, false))
      .then((p) => {
        console.log("\n--- Generated Post ---");
        console.log(p.content);
      });
    break;
  case "schedule":
    log("Starting daily batch scheduler...");
    // Batch runs once per day, generates the day's 2 drafts (video at 10 AM slot, carousel at 6:30 PM slot).
    // Drafts go to Slack for approval. Approval triggers immediate posting (see slack/handlers).
    const batchTime = process.env.BATCH_TIME || "08:30";
    log(`Batch generation scheduled at ${batchTime} ${config.bot.timezone}`);
    scheduleDailyJobs([batchTime], config.bot.timezone, runDailyBatch);
    break;
  case "comment-watch-once":
    initDb()
      .then(() => runCommentWatcherOnce())
      .then((s) => {
        console.log("\n--- Comment watcher run ---");
        console.log(JSON.stringify(s, null, 2));
        process.exit(0);
      })
      .catch((err) => {
        console.error("Comment watcher failed:", err);
        process.exit(1);
      });
    break;
  case "comment-watch":
    log("Starting comment-watcher scheduler...");
    // Default: top of every hour. Override with CW_CRON env var (cron syntax).
    const cwCron = process.env.CW_CRON || "0 * * * *";
    log(`Comment watcher scheduled at "${cwCron}" ${config.bot.timezone}`);
    scheduleIntervalJob(cwCron, config.bot.timezone, "comment-watcher", async () => {
      await runCommentWatcherOnce();
    });
    // Also run once immediately on startup so we don't wait an hour for first signal.
    initDb().then(() => runCommentWatcherOnce()).catch((err) => {
      log(`Initial comment-watcher run failed: ${err.message}`);
    });
    break;
  default:
    console.log(`
LinkedIn Bot - Slack-based Approval

Usage:
  npx tsx src/index.ts run                  Generate 2 posts (video + carousel) and send to Slack
  npx tsx src/index.ts research             Run research only
  npx tsx src/index.ts generate             Generate a single post (dry run)
  npx tsx src/index.ts schedule             Start the daily post-generation scheduler
  npx tsx src/index.ts comment-watch        Start the hourly comment-watcher loop
  npx tsx src/index.ts comment-watch-once   Run a single comment-watcher pass and exit

Setup:
  npx tsx scripts/setup-linkedin.ts   Complete LinkedIn OAuth setup
    `);
}
