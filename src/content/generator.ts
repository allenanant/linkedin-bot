import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import { getRecentPosts } from "../storage/db";

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

export interface ResearchData {
  trendingTopics: { keyword: string; relatedQueries: string[] }[];
  dailyTrends: string[];
  newsArticles: { title: string; description: string; source: string }[];
  competitorMentions: { title: string; description: string; source: string }[];
}

export interface GeneratedPost {
  content: string;
  imagePrompt: string | null;
  topic: string;
}

export async function generateLinkedInPost(
  research: ResearchData,
  shouldIncludeImage: boolean
): Promise<GeneratedPost> {
  const recentPosts = getRecentPosts(5);
  const recentTopics = recentPosts.map((p: any) => p.content?.slice(0, 100)).join("\n");

  const prompt = `You are a LinkedIn content strategist for a professional in the AI, SaaS, software, marketing, and ads industry.

Write an engaging LinkedIn post based on today's research data below.

Rules:
- Authentic and conversational, not corporate-sounding
- Start with a hook (first line grabs attention)
- Use short paragraphs and line breaks for readability
- Include 3-5 relevant hashtags at the end
- 150-300 words (optimal LinkedIn engagement length)
- Never start with "I'm excited to announce" or similar cliches
- Use data points and specific examples when possible
- Rotate between: hot takes, practical tips, lessons learned, trend analysis, contrarian opinions

TRENDING TOPICS:
${research.trendingTopics.map((t) => `- ${t.keyword}: ${t.relatedQueries.join(", ")}`).join("\n")}

DAILY TRENDS:
${research.dailyTrends.join(", ")}

RECENT NEWS:
${research.newsArticles
  .slice(0, 5)
  .map((a) => `- ${a.title} (${a.source}): ${a.description}`)
  .join("\n")}

COMPETITOR/INDUSTRY MENTIONS:
${research.competitorMentions
  .slice(0, 5)
  .map((a) => `- ${a.title} (${a.source}): ${a.description}`)
  .join("\n")}

RECENT POSTS (avoid repeating these topics):
${recentTopics || "None yet"}

${shouldIncludeImage ? "Also provide an IMAGE_PROMPT: a detailed description for generating a professional, visually appealing image to accompany this post. The image should be suitable for LinkedIn - clean, modern, and professional." : ""}

Respond in this EXACT format (no extra text outside this format):
TOPIC: [brief topic description]
POST:
[your LinkedIn post here]
${shouldIncludeImage ? "IMAGE_PROMPT:\n[detailed image generation prompt]" : ""}`;

  const text = await callGemini(prompt);

  const topicMatch = text.match(/TOPIC:\s*(.+)/);
  const postMatch = text.match(/POST:\s*([\s\S]*?)(?=IMAGE_PROMPT:|$)/);
  const imagePromptMatch = text.match(/IMAGE_PROMPT:\s*([\s\S]*?)$/);

  return {
    topic: topicMatch?.[1]?.trim() || "Industry Insight",
    content: postMatch?.[1]?.trim() || text.trim(),
    imagePrompt: shouldIncludeImage ? imagePromptMatch?.[1]?.trim() || null : null,
  };
}

async function callGemini(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    return text.trim();
  } catch (err: any) {
    console.error(`Gemini API call failed: ${err.message}`);
    throw new Error("Failed to generate content via Gemini API.");
  }
}
