import fs from "fs";
import { config } from "./config";
import { generateLinkedInPost } from "./content/generator";
import { generateImage } from "./content/image-generator";
import { generateCarousel, shouldGenerateCarousel } from "./content/carousel-generator";
import { createTextPost, createImagePost, createDocumentPost } from "./linkedin/post";
import { initDb, savePost, markPostPublished, getTodayPostCount, getApprovedPosts, getPostImage, getPostPdf } from "./storage/db";
import { scheduleDailyJobs } from "./scheduler/cron";
import { notifyDraftReady, notifyPostPublished, notifyPipelineError } from "./notifications/slack";
import { runResearch } from "./pipeline/research";

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function publishApprovedPosts() {
  const approved = await getApprovedPosts();
  for (const post of approved) {
    try {
      log(`Publishing approved post #${post.id} (type: ${post.post_type || "text"})...`);
      let linkedinPostId: string;

      // Check for PDF carousel first
      if (post.post_type === "carousel") {
        const pdfData = await getPostPdf(post.id);
        if (pdfData) {
          linkedinPostId = await createDocumentPost(
            config.linkedin.accessToken,
            config.linkedin.personUrn,
            post.content,
            pdfData
          );
        } else {
          log(`Post #${post.id} is carousel but has no PDF data. Falling back to text.`);
          linkedinPostId = await createTextPost(config.linkedin.accessToken, config.linkedin.personUrn, post.content);
        }
      } else {
        // Image or text post
        const imageRecord = await getPostImage(post.id);
        if (imageRecord && imageRecord.data) {
          linkedinPostId = await createImagePost(config.linkedin.accessToken, config.linkedin.personUrn, post.content, imageRecord.data);
        } else if (post.image_path) {
          linkedinPostId = await createImagePost(config.linkedin.accessToken, config.linkedin.personUrn, post.content, post.image_path);
        } else {
          linkedinPostId = await createTextPost(config.linkedin.accessToken, config.linkedin.personUrn, post.content);
        }
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

  const maxPostsPerDay = 3;
  const todayCount = await getTodayPostCount();
  if (todayCount >= maxPostsPerDay) {
    log(`Already posted ${todayCount} time(s) today (max ${maxPostsPerDay}). Skipping.`);
    return;
  }
  log(`Post ${todayCount + 1} of ${maxPostsPerDay} for today.`);

  try {
    // Step 1: Research
    const research = await runResearch();

    // Step 2: Generate content
    log("Generating post content with AI...");
    const generated = await generateLinkedInPost(research, true);
    log(`Generated post about: ${generated.topic}`);

    // Step 3: Always generate PDF carousel
    let imagePath: string | null = null;
    let imageBuffer: Buffer | null = null;
    let pdfBuffer: Buffer | null = null;
    let postType = "text";

    log("Generating PDF carousel...");
    try {
      pdfBuffer = await generateCarousel(generated.content, generated.topic);
      postType = "carousel";
      log(`Carousel PDF generated: ${pdfBuffer.length} bytes`);
    } catch (err: any) {
      log(`Carousel generation failed: ${err.message}. Falling back to image.`);
      pdfBuffer = null;
    }

    if (!pdfBuffer && generated.imageData) {
      // Fallback to image only if carousel fails
      log("Rendering fallback image...");
      imagePath = await generateImage(generated.imageData);
      if (imagePath) {
        imageBuffer = fs.readFileSync(imagePath);
        postType = "image";
      } else {
        log("Image generation also failed. Posting as text-only.");
      }
    }

    // Step 4: Save draft to database
    const postId = await savePost({
      content: generated.content,
      imagePath: imagePath || undefined,
      imagePrompt: generated.imageData ? JSON.stringify(generated.imageData) : undefined,
      researchData: JSON.stringify(research),
      status: "draft",
      imageData: imageBuffer || undefined,
      pdfData: pdfBuffer || undefined,
      postType,
    });
    log(`Saved post #${postId} as ${postType} draft. Review and publish from the dashboard.`);

    // Step 5: Notify via Slack
    await notifyDraftReady({
      postId,
      content: generated.content,
      hasImage: !!imagePath || !!pdfBuffer,
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
        if (p.imageData) console.log("\n--- Image Data ---\n" + JSON.stringify(p.imageData));
      });
    break;
  case "schedule":
    log(`Scheduling daily posts at ${config.bot.postTimes.join(", ")} ${config.bot.timezone}`);
    scheduleDailyJobs(config.bot.postTimes, config.bot.timezone, runDailyPipeline);
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
