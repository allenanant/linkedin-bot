import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  linkedin: {
    clientId: required("LINKEDIN_CLIENT_ID"),
    clientSecret: required("LINKEDIN_CLIENT_SECRET"),
    accessToken: optional("LINKEDIN_ACCESS_TOKEN", ""),
    refreshToken: optional("LINKEDIN_REFRESH_TOKEN", ""),
    personUrn: optional("LINKEDIN_PERSON_URN", ""),
    redirectUri: optional("LINKEDIN_REDIRECT_URI", "http://localhost:3456/callback"),
  },
  gemini: {
    apiKey: required("GEMINI_API_KEY"),
  },
  newsApi: {
    apiKey: required("NEWS_API_KEY"),
  },
  bot: {
    postTime: optional("POST_TIME", "09:00"),
    timezone: optional("TIMEZONE", "America/New_York"),
    industryKeywords: optional("INDUSTRY_KEYWORDS", "AI,SaaS,software,marketing,ads").split(",").map((k) => k.trim()),
    imagePostPercentage: parseInt(optional("IMAGE_POST_PERCENTAGE", "40"), 10),
    autoPost: optional("AUTO_POST", "true") === "true",
  },
  database: {
    url: optional("DATABASE_URL", ""),
  },
  dashboard: {
    port: parseInt(optional("DASHBOARD_PORT", "3000"), 10),
  },
  reddit: {
    subreddits: optional("REDDIT_SUBREDDITS", "SaaS,marketing,artificial,webdev,entrepreneur,startups").split(",").map((s) => s.trim()),
    postsPerSubreddit: parseInt(optional("REDDIT_POSTS_PER_SUB", "5"), 10),
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || process.env.GEMINI_API_KEY || "",
    videosPerKeyword: parseInt(optional("YOUTUBE_VIDEOS_PER_KEYWORD", "3"), 10),
  },
  socialSearch: {
    apiKey: process.env.GOOGLE_SEARCH_API_KEY || "",
    searchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID || "",
  },
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL || "",
    dashboardUrl: process.env.DASHBOARD_URL || "",
  },
  paths: {
    db: path.resolve(__dirname, "../data/posts.db"),
    images: path.resolve(__dirname, "../data/images"),
  },
};
