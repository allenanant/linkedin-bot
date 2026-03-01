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

  const prompt = `You are writing a LinkedIn post for a professional in AI, SaaS, software, marketing, and ads.

Your writing style MUST follow these rules strictly:

FORMAT RULES:
- Every single line should be its own sentence. One line = one thought. No paragraphs.
- Use line breaks aggressively. White space is your friend.
- Start with a bold hook line that makes people stop scrolling (a claim, news, or contrarian take)
- Second line should add context or a "(here's why)" / "(save this)" style parenthetical
- Use numbered lists (1. 2. 3.) or arrow lists (↳) for actionable steps
- Use short punchy sentences. 5-12 words per line is ideal.
- End with a call to action: "♻️ Repost this" or "Save this for later."
- NO hashtags. These creators never use hashtags.
- 200-400 words total

TONE RULES:
- Write like you're texting a smart friend, not writing an essay
- Be direct. Be blunt. No fluff. No filler.
- Never use corporate buzzwords: "leverage", "synergy", "excited to announce", "thrilled", "game-changer"
- Never use AI-sounding words: "delve", "landscape", "tapestry", "unleash", "harness", "paradigm", "robust"
- Never start with "I'm excited" or "In today's fast-paced world" or similar cliches
- Sound like a person who actually uses the tools, not someone reporting from the sideline
- Use contractions. "It's" not "It is". "Don't" not "Do not".
- Be opinionated. Take a stance. Don't hedge with "it depends."

CONTENT RULES:
- Focus on ONE specific tool, trend, or insight. Not a general overview.
- Give actual step-by-step instructions people can follow RIGHT NOW
- Include specific numbers, names, model versions when possible
- If covering news: state what happened, why it matters, what to do about it
- If giving tips: numbered steps someone can copy-paste and use today
- If sharing an opinion: back it up with a specific example or comparison
- Rotate between these post types:
  * "NEWS: [thing] just dropped. Here's what you need to know:" + numbered breakdown
  * "How to [specific thing] with [specific tool]:" + step-by-step
  * "Stop doing [common mistake]. Here's why:" + explanation + better alternative
  * "[Tool A] vs [Tool B]. I tested both." + comparison with verdict
  * "I just found [specific thing]. Most people are sleeping on this." + walkthrough

WHAT TO NEVER DO:
- Never write long paragraphs. Ever. One line per thought.
- Never be vague. "AI is changing everything" = bad. "Claude Opus 4.6 just outperformed GPT-5 on coding benchmarks" = good.
- Never write like a press release or a blog intro.
- Never use em-dashes (—). Use periods instead.
- Never start consecutive lines with the same word.

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

${shouldIncludeImage ? "Also provide an IMAGE_PROMPT: a detailed description for generating a professional infographic-style image or clean visual that accompanies this post. Think: simple diagram, comparison chart, step-by-step visual, or bold text overlay on a clean background. NOT a generic stock photo." : ""}

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
