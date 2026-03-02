import fs from "fs";
import { config } from "./config";
import { fetchTrendingTopics, fetchDailyTrends } from "./research/trending";
import { fetchIndustryNews, fetchTopHeadlines } from "./research/news";
import { fetchCompetitorMentions } from "./research/competitors";
import { fetchRedditDiscussions } from "./research/reddit";
import { fetchYouTubeTopics } from "./research/youtube";
import { fetchSocialSearchResults } from "./research/social-search";
import { generateLinkedInPost, ResearchData } from "./content/generator";
import { generateImage, shouldGenerateImage } from "./content/image-generator";
import { createTextPost, createImagePost } from "./linkedin/post";
import { updateAllAnalytics } from "./linkedin/analytics";
import { initDb, savePost, markPostPublished, getTodayPostCount, saveResearchCache, getApprovedPosts, getPostImage } from "./storage/db";
import { scheduleDailyJob } from "./scheduler/cron";
import { notifyDraftReady, notifyPostPublished, notifyPipelineError } from "./notifications/slack";

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function runResearch(): Promise<ResearchData> {
  log("Starting research phase...");

  // Wrap each source in .catch() so one failure doesn't kill the pipeline
  const safe = <T>(p: Promise<T>, name: string): Promise<T | []> =>
    p.catch((err: any) => {
      log(`WARNING: ${name} failed: ${err.message}`);
      return [] as any;
    });

  const [trendingTopics, dailyTrends, newsArticles, headlines, competitorMentions, redditDiscussions, youtubeTopics, socialSearchResults] =
    await Promise.all([
      safe(fetchTrendingTopics(config.bot.industryKeywords), "Google Trends"),
      safe(fetchDailyTrends(), "Daily Trends"),
      safe(fetchIndustryNews(config.newsApi.apiKey, config.bot.industryKeywords), "Industry News"),
      safe(fetchTopHeadlines(config.newsApi.apiKey), "Headlines"),
      safe(fetchCompetitorMentions(config.newsApi.apiKey), "Competitors"),
      safe(fetchRedditDiscussions(config.reddit.subreddits, config.reddit.postsPerSubreddit), "Reddit"),
      safe(fetchYouTubeTopics(config.youtube.apiKey, config.bot.industryKeywords, config.youtube.videosPerKeyword), "YouTube"),
      safe(fetchSocialSearchResults(config.socialSearch.apiKey, config.socialSearch.searchEngineId, config.bot.industryKeywords), "Social Search"),
    ]);

  const allNews = [...(newsArticles as any[] || []), ...(headlines as any[] || [])];

  const research: ResearchData = {
    trendingTopics: trendingTopics as any || [],
    dailyTrends: dailyTrends as any || [],
    newsArticles: allNews,
    competitorMentions: competitorMentions as any || [],
    redditDiscussions: redditDiscussions as any || [],
    youtubeTopics: youtubeTopics as any || [],
    socialSearchResults: socialSearchResults as any || [],
  };

  await saveResearchCache("daily", research);
  log(
    `Research complete: ${(research.trendingTopics || []).length} trends, ${allNews.length} articles, ` +
    `${(research.competitorMentions || []).length} competitor mentions, ` +
    `${(research.redditDiscussions || []).length} Reddit posts, ` +
    `${(research.youtubeTopics || []).length} YouTube videos`
  );

  return research;
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
    if (generated.imagePrompt) {
      log("Generating image with Gemini...");
      imagePath = await generateImage(generated.imagePrompt);
      if (!imagePath) {
        log("Image generation failed. Retrying once...");
        imagePath = await generateImage(generated.imagePrompt);
      }
      if (!imagePath) {
        log("Image generation failed twice. Posting as text-only.");
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
      status: "draft",
      imageData: imageBuffer || undefined,
    });
    log(`Saved post #${postId} as draft. Review and publish from the dashboard.`);

    // Step 7: Notify via Slack
    await notifyDraftReady({
      postId,
      content: generated.content,
      hasImage: !!imagePath,
      topic: generated.topic,
    });

    // Step 8: Update analytics for previous posts
    log("Updating analytics for recent posts...");
    await updateAllAnalytics(config.linkedin.accessToken);

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
