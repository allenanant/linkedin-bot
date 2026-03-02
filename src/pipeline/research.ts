import { config } from "../config";
import { fetchTrendingTopics, fetchDailyTrends } from "../research/trending";
import { fetchIndustryNews, fetchTopHeadlines } from "../research/news";
import { fetchCompetitorMentions } from "../research/competitors";
import { fetchRedditDiscussions } from "../research/reddit";
import { fetchYouTubeTopics } from "../research/youtube";
import { fetchSocialSearchResults } from "../research/social-search";
import { ResearchData } from "../content/generator";
import { saveResearchCache } from "../storage/db";

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

export async function runResearch(): Promise<ResearchData> {
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
