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
  const recentPosts = await getRecentPosts(5);
  const recentTopics = recentPosts.map((p: any) => p.content?.slice(0, 100)).join("\n");

  const prompt = `You are writing a LinkedIn post for Allen Anant Thomas, a marketing professional and founder who helps businesses grow using AI-powered marketing strategies.

AUDIENCE: Business owners, founders, marketers, and sales leaders who want practical ways to use AI to grow their business. NOT engineers. NOT developers. NOT technical people.

Your writing style MUST follow these rules strictly:

FORMAT RULES:
- Every single line should be its own sentence. One line = one thought. No paragraphs.
- Use line breaks aggressively. White space is your friend.
- Start with a bold hook line that makes people stop scrolling (a business insight, marketing tip, or contrarian take about growth)
- Second line should add context or a "(here's why)" / "(save this)" style parenthetical
- Use numbered lists (1. 2. 3.) or arrow lists (↳) for actionable steps
- Use short punchy sentences. 5-12 words per line is ideal.
- ALWAYS end with a connect + comment CTA: "1. Connect with me (so I can DM you) 2. Comment '[KEYWORD]' and I'll send you [something valuable]." Use keywords like 'GROWTH', 'MARKETING', 'AI', 'SALES', 'STRATEGY', etc.
- NO hashtags. These creators never use hashtags.
- 200-400 words total

TONE RULES:
- Write like you're texting a smart business friend, not writing an essay
- Be direct. Be blunt. No fluff. No filler.
- Sound like a marketing expert who understands business, NOT a tech nerd
- Never use corporate buzzwords: "leverage", "synergy", "excited to announce", "thrilled", "game-changer"
- Never use AI-sounding words: "delve", "landscape", "tapestry", "unleash", "harness", "paradigm", "robust"
- Never start with "I'm excited" or "In today's fast-paced world" or similar cliches
- Use contractions. "It's" not "It is". "Don't" not "Do not".
- Be opinionated. Take a stance. Don't hedge with "it depends."

CONTENT RULES - THIS IS CRITICAL:
- Focus on the BUSINESS VALUE of AI tools, not the technology itself
- Frame everything around: revenue, leads, conversions, time saved, customer acquisition, marketing ROI
- NEVER mention model names, version numbers, API details, or technical specs
- NEVER discuss coding, programming, engineering concepts, or developer tools
- NEVER talk about benchmarks, parameters, fine-tuning, or technical performance
- Instead of "GPT-5 has 2T parameters" say "There's a new AI tool that writes your ad copy in 30 seconds"
- Instead of "This framework orchestrates multi-agent workflows" say "This tool automates your entire marketing funnel"
- Always tie back to: How does this help a business owner make more money, save time, or get more customers?
- Give practical tips business owners can use TODAY without any technical knowledge
- Rotate between these post types:
  * "Most businesses waste money on [thing]. Here's what the smart ones do:" + tips
  * "I helped a client [achieve result] using AI. Here's the exact process:" + steps
  * "Stop doing [common marketing mistake]. Here's why it's killing your growth:" + alternative
  * "[Number] ways AI is saving business owners [X] hours per week" + list
  * "Your competitors are already using AI for [thing]. Here's how to catch up:" + actionable steps
  * "The #1 reason your [ads/emails/content] aren't converting:" + fix

WHAT TO NEVER DO:
- NEVER write about technical AI topics (model architectures, APIs, code, frameworks)
- NEVER mention specific model names or versions (GPT-4, Claude, Llama, etc.)
- Never write long paragraphs. Ever. One line per thought.
- Never be vague. Give specific, actionable business advice.
- Never write like a press release or a blog intro.
- Never use em-dashes (—). Use periods instead.
- Never start consecutive lines with the same word.
- NEVER sound like an engineer or developer. Sound like a marketing strategist.

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

Pick the most interesting, specific, and actionable topic from the research above. Write ONE focused post about it.

Also provide an IMAGE_PROMPT for an eye-catching visual to accompany this post.

IMAGE STYLE RULES:
- Create a clean, professional infographic or visual summary of the post's key points
- Use bold typography with the main headline/stat from the post
- Use a modern, minimal design with a dark or gradient background
- Include 3-5 key bullet points or numbered steps as visual text overlays
- Use icons or simple illustrations (NOT stock photos, NOT AI-generated faces)
- Think: professional marketing slide, not a technical diagram
- Color palette: modern blues, purples, or gradient backgrounds with white text
- The image should work as a standalone visual that makes people stop scrolling
- Include a subtle branding element like "Allen Anant Thomas" or a simple logo mark
- NO code snippets, NO terminal screenshots, NO technical diagrams
- Think: Canva-style marketing visual that a business owner would share

Respond in this EXACT format (no extra text outside this format):
TOPIC: [brief topic description]
POST:
[your LinkedIn post here]
IMAGE_PROMPT:
[detailed image generation prompt]`;

  const text = await callGemini(prompt);

  const topicMatch = text.match(/TOPIC:\s*(.+)/);
  const postMatch = text.match(/POST:\s*([\s\S]*?)(?=IMAGE_PROMPT:|$)/);
  const imagePromptMatch = text.match(/IMAGE_PROMPT:\s*([\s\S]*?)$/);

  return {
    topic: topicMatch?.[1]?.trim() || "Marketing Insight",
    content: postMatch?.[1]?.trim() || text.trim(),
    imagePrompt: imagePromptMatch?.[1]?.trim() || null,
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
