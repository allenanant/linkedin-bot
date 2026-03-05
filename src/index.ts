import fs from "fs";
import { config } from "./config";
import { generateLinkedInPost } from "./content/generator";
import { generateImage, shouldGenerateImage } from "./content/image-generator";
import { createTextPost, createImagePost } from "./linkedin/post";
import { initDb, savePost, markPostPublished, getTodayPostCount, getApprovedPosts, getPostImage } from "./storage/db";
import { scheduleDailyJob } from "./scheduler/cron";
import { notifyDraftReady, notifyPostPublished, notifyPipelineError } from "./notifications/slack";
import { runResearch } from "./pipeline/research";

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function publishApprovedPosts() {
  const approved = await getApprovedPosts();
  for (const post of approved) {
    try {
      log(`Publishing approved post #${post.id}...`);
      let linkedinPostId: string;
      const imageRecord = await getPostImage(post.id);
      if (imageRecord && imageRecord.data) {
        linkedinPostId = await createImagePost(config.linkedin.accessToken, config.linkedin.personUrn, post.content, imageRecord.data);
      } else if (post.image_path) {
        linkedinPostId = await createImagePost(config.linkedin.accessToken, config.linkedin.personUrn, post.content, post.image_path);
      } else {
        linkedinPostId = await createTextPost(config.linkedin.accessToken, config.linkedin.personUrn, post.content);
      }
      await markPostPublished(post.id, linkedinPostId);
      log(`Published approved post #${post.id}: ${linkedinPostId}`);
      await notifyPostPublished(post.id, linkedinPostId);
    } catch (err: any) {
      log(`Failed to publish approved post #${post.id}: ${err.message}`);
    }
  }
}

async function runDailyPipeline() {
  log("=== Starting daily LinkedIn pipeline ===");

  await initDb();
  await publishApprovedPosts();

  // Allow up to 2 posts per day
  const maxPostsPerDay = 2;
  const todayCount = await getTodayPostCount();
  if (todayCount >= maxPostsPerDay) {
    log(`Already posted ${todayCount} time(s) today (max ${maxPostsPerDay}). Skipping.`);
    return;
  }
  log(`Post ${todayCount + 1} of ${maxPostsPerDay} for today.`);

  try {
    // Step 1: Research
    const research = await runResearch();

    // Step 2: Generate content (always with image prompt)
    log("Generating post content with AI...");
    const generated = await generateLinkedInPost(research, true);
    log(`Generated post about: ${generated.topic}`);

    // Step 3: Generate image (always)
    let imagePath: string | null = null;
    if (generated.imageData) {
      log("Rendering image...");
      imagePath = await generateImage(generated.imageData);
      if (!imagePath) {
        log("Image rendering failed. Retrying once...");
        imagePath = await generateImage(generated.imageData);
      }
      if (!imagePath) {
        log("Image generation failed twice. Posting as text-only.");
      }
    }

    // Step 4: Read image data if present
    let imageBuffer: Buffer | null = null;
    if (imagePath) {
      imageBuffer = fs.readFileSync(imagePath);
    }

    // Step 5: Save draft to database
    const postId = await savePost({
      content: generated.content,
      imagePath: imagePath || undefined,
      imagePrompt: generated.imageData ? JSON.stringify(generated.imageData) : undefined,
      researchData: JSON.stringify(research),
      status: "draft",
      imageData: imageBuffer || undefined,
    });
    log(`Saved post #${postId} as draft. Review and publish from the dashboard.`);

    // Step 6: Notify via Slack
    await notifyDraftReady({
      postId,
      content: generated.content,
      hasImage: !!imagePath,
      topic: generated.topic,
    });

    log("=== Daily pipeline complete ===");
  } catch (err: any) {
    log(`ERROR: ${err.message}`);
    console.error(err);
    await notifyPipelineError(err.message);
  }
}

// CLI entry points
const command = process.argv[2];

switch (command) {
  case "run":
    runDailyPipeline();
    break;
  case "research":
    initDb().then(() => runResearch()).then((r) => console.log(JSON.stringify(r, null, 2)));
    break;
  case "generate":
    initDb().then(() => runResearch())
      .then((r) => generateLinkedInPost(r, true))
      .then((p) => {
        console.log("\n--- Generated Post ---");
        console.log(p.content);
        if (p.imagePrompt) console.log("\n--- Image Prompt ---\n" + p.imagePrompt);
      });
    break;
  case "schedule":
    log(`Scheduling daily post at ${config.bot.postTime} ${config.bot.timezone}`);
    scheduleDailyJob(config.bot.postTime, config.bot.timezone, runDailyPipeline);
    break;
  default:
    console.log(`
LinkedIn Bot - Daily Automation

Usage:
  npx tsx src/index.ts run         Run the full pipeline once (research + generate + post)
  npx tsx src/index.ts research    Run research only
  npx tsx src/index.ts generate    Generate a post (dry run, no publishing)
  npx tsx src/index.ts schedule    Start the daily scheduler

Setup:
  npx tsx scripts/setup-linkedin.ts   Complete LinkedIn OAuth setup
    `);
}
