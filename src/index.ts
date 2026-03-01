import fs from "fs";
import { config } from "./config";
import { fetchTrendingTopics, fetchDailyTrends } from "./research/trending";
import { fetchIndustryNews, fetchTopHeadlines } from "./research/news";
import { fetchCompetitorMentions } from "./research/competitors";
import { generateLinkedInPost, ResearchData } from "./content/generator";
import { generateImage, shouldGenerateImage } from "./content/image-generator";
import { createTextPost, createImagePost } from "./linkedin/post";
import { updateAllAnalytics } from "./linkedin/analytics";
import { initDb, savePost, markPostPublished, getTodayPostCount, saveResearchCache, getApprovedPosts } from "./storage/db";
import { scheduleDailyJob } from "./scheduler/cron";

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function runResearch(): Promise<ResearchData> {
  log("Starting research phase...");

  const [trendingTopics, dailyTrends, newsArticles, headlines, competitorMentions] =
    await Promise.all([
      fetchTrendingTopics(config.bot.industryKeywords),
      fetchDailyTrends(),
      fetchIndustryNews(config.newsApi.apiKey, config.bot.industryKeywords),
      fetchTopHeadlines(config.newsApi.apiKey),
      fetchCompetitorMentions(config.newsApi.apiKey),
    ]);

  const allNews = [...newsArticles, ...headlines];

  const research: ResearchData = {
    trendingTopics,
    dailyTrends,
    newsArticles: allNews,
    competitorMentions,
  };

  await saveResearchCache("daily", research);
  log(`Research complete: ${trendingTopics.length} trends, ${allNews.length} articles, ${competitorMentions.length} competitor mentions`);

  return research;
}

async function publishApprovedPosts() {
  const approved = await getApprovedPosts();
  for (const post of approved) {
    try {
      log(`Publishing approved post #${post.id}...`);
      let linkedinPostId: string;
      if (post.image_path) {
        linkedinPostId = await createImagePost(config.linkedin.accessToken, config.linkedin.personUrn, post.content, post.image_path);
      } else {
        linkedinPostId = await createTextPost(config.linkedin.accessToken, config.linkedin.personUrn, post.content);
      }
      await markPostPublished(post.id, linkedinPostId);
      log(`Published approved post #${post.id}: ${linkedinPostId}`);
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

    // Step 2: Decide if this post gets an image
    const includeImage = shouldGenerateImage();
    log(`Post type: ${includeImage ? "with image" : "text only"}`);

    // Step 3: Generate content
    log("Generating post content with AI...");
    const generated = await generateLinkedInPost(research, includeImage);
    log(`Generated post about: ${generated.topic}`);

    // Step 4: Generate image if needed
    let imagePath: string | null = null;
    if (includeImage && generated.imagePrompt) {
      log("Generating image with Gemini...");
      imagePath = await generateImage(generated.imagePrompt);
      if (!imagePath) {
        log("Image generation failed. Retrying once...");
        imagePath = await generateImage(generated.imagePrompt);
      }
      if (!imagePath) {
        log("Image generation failed twice. Skipping this post to avoid posting without image.");
        return;
      }
    }

    // Step 5: Read image data if present
    let imageBuffer: Buffer | null = null;
    if (imagePath) {
      imageBuffer = fs.readFileSync(imagePath);
    }

    // Step 6: Save draft to database
    const postId = await savePost({
      content: generated.content,
      imagePath: imagePath || undefined,
      imagePrompt: generated.imagePrompt || undefined,
      researchData: JSON.stringify(research),
      status: config.bot.autoPost ? "publishing" : "draft",
      imageData: imageBuffer || undefined,
    });
    log(`Saved post #${postId} to database`);

    // Step 7: Publish if auto-post is enabled
    if (config.bot.autoPost) {
      log("Publishing to LinkedIn...");
      let linkedinPostId: string;

      if (imagePath) {
        linkedinPostId = await createImagePost(
          config.linkedin.accessToken,
          config.linkedin.personUrn,
          generated.content,
          imagePath
        );
      } else {
        linkedinPostId = await createTextPost(
          config.linkedin.accessToken,
          config.linkedin.personUrn,
          generated.content
        );
      }

      await markPostPublished(postId, linkedinPostId);
      log(`Published! LinkedIn post ID: ${linkedinPostId}`);
    } else {
      log("Draft saved. Review and publish manually.");
    }

    // Step 8: Update analytics for previous posts
    log("Updating analytics for recent posts...");
    await updateAllAnalytics(config.linkedin.accessToken);

    log("=== Daily pipeline complete ===");
  } catch (err: any) {
    log(`ERROR: ${err.message}`);
    console.error(err);
  }
}

// CLI entry points
const command = process.argv[2];

switch (command) {
  case "run":
    runDailyPipeline();
    break;
  case "research":
    runResearch().then((r) => console.log(JSON.stringify(r, null, 2)));
    break;
  case "generate":
    runResearch()
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
  case "analytics":
    updateAllAnalytics(config.linkedin.accessToken);
    break;
  default:
    console.log(`
LinkedIn Bot - Daily Automation

Usage:
  npx tsx src/index.ts run         Run the full pipeline once (research + generate + post)
  npx tsx src/index.ts research    Run research only
  npx tsx src/index.ts generate    Generate a post (dry run, no publishing)
  npx tsx src/index.ts schedule    Start the daily scheduler
  npx tsx src/index.ts analytics   Update analytics for recent posts

Setup:
  npx tsx scripts/setup-linkedin.ts   Complete LinkedIn OAuth setup
    `);
}
