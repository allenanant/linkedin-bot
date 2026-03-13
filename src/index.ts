import { config } from "./config";
import { generateLinkedInPost } from "./content/generator";
import { generateCarousel } from "./content/carousel-generator";
import { initDb, savePost } from "./storage/db";
import { scheduleDailyJobs } from "./scheduler/cron";
import { notifyPipelineError } from "./notifications/slack";
import { sendDraftToSlack } from "./slack/send-draft";
import { runResearch } from "./pipeline/research";

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function generateOnePost(
  research: any,
  index: number,
  total: number
): Promise<void> {
  log(`--- Generating post ${index}/${total} ---`);

  // Generate content
  const generated = await generateLinkedInPost(research, false);
  log(`Post ${index}: topic = ${generated.topic.slice(0, 80)}`);

  // Generate PDF carousel
  let pdfBuffer: Buffer | null = null;
  let postType = "text";

  try {
    pdfBuffer = await generateCarousel(generated.content, generated.topic);
    postType = "carousel";
    log(`Post ${index}: carousel PDF generated (${pdfBuffer.length} bytes)`);
  } catch (err: any) {
    log(`Post ${index}: carousel failed (${err.message}). Saving as text-only.`);
  }

  // Save to DB
  const postId = await savePost({
    content: generated.content,
    researchData: JSON.stringify(research),
    status: "draft",
    pdfData: pdfBuffer || undefined,
    postType,
  });
  log(`Post ${index}: saved as draft #${postId}`);

  // Send to Slack for review
  await sendDraftToSlack({
    id: postId,
    content: generated.content,
    topic: generated.topic,
    pdfData: pdfBuffer,
    postType,
    batchIndex: index,
    batchTotal: total,
  });
}

async function runDailyBatch() {
  log("=== Starting daily LinkedIn batch ===");

  await initDb();

  const postsPerBatch = 5;

  try {
    // Step 1: Research (shared for all posts)
    log("Running research...");
    const research = await runResearch();
    log("Research complete.");

    // Step 2: Generate posts one by one
    for (let i = 1; i <= postsPerBatch; i++) {
      try {
        await generateOnePost(research, i, postsPerBatch);
      } catch (err: any) {
        log(`Post ${i}/${postsPerBatch} failed: ${err.message}`);
        // Continue to next post
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
    // Generate all 5 posts at 12:00 PM IST daily
    const batchTime = "12:00";
    log(`Batch generation scheduled at ${batchTime} ${config.bot.timezone}`);
    scheduleDailyJobs([batchTime], config.bot.timezone, runDailyBatch);
    break;
  default:
    console.log(`
LinkedIn Bot - Slack-based Approval

Usage:
  npx tsx src/index.ts run         Generate 5 posts and send to Slack
  npx tsx src/index.ts research    Run research only
  npx tsx src/index.ts generate    Generate a single post (dry run)
  npx tsx src/index.ts schedule    Start the daily scheduler

Setup:
  npx tsx scripts/setup-linkedin.ts   Complete LinkedIn OAuth setup
    `);
}
