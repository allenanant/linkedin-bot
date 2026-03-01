import { GoogleGenAI } from "@google/genai";
import { config } from "../config";
import { getRecentPosts } from "../storage/db";

const genAI = new GoogleGenAI({ apiKey: config.gemini.apiKey });

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

// ─── Step 1: Analyze research & find the best topic ───

async function pickTopic(research: ResearchData, recentTopics: string): Promise<string> {
  const prompt = `You are a LinkedIn content strategist for Allen Anant Thomas, who helps business owners grow using AI-powered marketing.

AUDIENCE: Business owners, founders, marketers, and sales leaders.

Look at this research data and pick the SINGLE most interesting topic for a LinkedIn post:

TRENDING TOPICS:
${research.trendingTopics.map((t) => `- ${t.keyword}: ${t.relatedQueries.join(", ")}`).join("\n")}

DAILY TRENDS:
${research.dailyTrends.join(", ")}

RECENT NEWS:
${research.newsArticles.slice(0, 5).map((a) => `- ${a.title} (${a.source}): ${a.description}`).join("\n")}

INDUSTRY MENTIONS:
${research.competitorMentions.slice(0, 5).map((a) => `- ${a.title} (${a.source}): ${a.description}`).join("\n")}

AVOID THESE (already posted recently):
${recentTopics || "None yet"}

RULES:
- Pick a topic that business owners CARE about (revenue, leads, time savings, marketing ROI)
- Frame it from a business angle, NOT a technology angle
- The topic should be specific and actionable, not vague
- If there's a new AI tool in the news, focus on what business problem it solves, not its technical specs

Respond with ONLY the topic in 1-2 sentences. Nothing else.`;

  return await callGemini(prompt);
}

// ─── Step 2: Research similar high-performing posts ───

async function researchSimilarPosts(topic: string): Promise<string> {
  const prompt = `You are a LinkedIn content expert. I'm writing a post about: "${topic}"

Research and describe 3 examples of high-performing LinkedIn posts on this topic or similar topics. For each, explain:
1. What hook they used to grab attention
2. What value they provided (frameworks, tips, stories, data points)
3. What CTA they used
4. Why it performed well (what made people engage)

Also identify:
- What common patterns top creators use for this type of content
- What kind of "lead magnet" or free resource would people want related to this topic
- What contrarian or surprising angle would stand out

Be specific. Give real patterns, not generic advice.`;

  return await callGemini(prompt);
}

// ─── Step 3: Brainstorm value to provide ───

async function brainstormValue(topic: string, similarPosts: string): Promise<string> {
  const prompt = `You are brainstorming a LinkedIn post for Allen Anant Thomas about: "${topic}"

Here's what similar successful posts look like:
${similarPosts}

Now brainstorm:
1. What are 5 specific, actionable pieces of value we can give readers on this topic?
2. What framework, checklist, or step-by-step process can we share?
3. What's a surprising stat or insight that would make someone stop scrolling?
4. What free resource could we offer in the CTA that people would actually want? (e.g., "Comment 'GROWTH' and I'll send you my exact ad copy template")
5. What's the boldest, most attention-grabbing hook for this topic?

Think like a marketer who understands business pain points. NOT like a tech writer.`;

  return await callGemini(prompt);
}

// ─── Step 4: Generate 3 post variations ───

async function generateVariations(topic: string, valueIdeas: string): Promise<string> {
  const prompt = `Write 3 different LinkedIn post variations about: "${topic}"

Use these value ideas:
${valueIdeas}

STRICT FORMAT RULES (follow these EXACTLY):
- Every single line should be its own sentence. One line = one thought. No paragraphs.
- Use line breaks aggressively. White space is your friend.
- Start with a bold hook that makes business owners stop scrolling
- Use numbered lists (1. 2. 3.) or arrow lists (↳) for actionable steps
- Short punchy sentences. 5-12 words per line.
- ALWAYS end with: "1. Connect with me (so I can DM you) 2. Comment '[KEYWORD]' and I'll send you [something valuable]."
- Use keywords like 'GROWTH', 'MARKETING', 'AI', 'SALES', 'STRATEGY', 'LEADS', 'REVENUE'
- NO hashtags ever.
- 200-400 words per variation.

TONE RULES:
- Write like you're texting a smart business friend
- Be direct. Be blunt. No fluff.
- Sound like a marketing expert, NOT a tech nerd
- NEVER use: "leverage", "synergy", "excited to announce", "thrilled", "game-changer", "delve", "landscape", "tapestry", "unleash", "harness", "paradigm", "robust"
- NEVER start with "I'm excited" or "In today's fast-paced world"
- Use contractions. Be opinionated. Take a stance.

CONTENT RULES:
- Focus on BUSINESS VALUE: revenue, leads, conversions, time saved, customer acquisition
- NEVER mention model names, version numbers, APIs, technical specs
- NEVER discuss coding, programming, engineering, or developer tools
- Give practical tips business owners can use TODAY
- Frame AI as a business tool, like a marketing assistant, not as technology

Each variation should have a DIFFERENT hook, DIFFERENT angle, and DIFFERENT CTA keyword.

Format:
VARIATION 1:
[post content]

VARIATION 2:
[post content]

VARIATION 3:
[post content]`;

  return await callGemini(prompt);
}

// ─── Step 5: Humanize all variations ───

async function humanizeVariations(variations: string): Promise<string> {
  const prompt = `You are a professional editor. These 3 LinkedIn post drafts need to sound MORE HUMAN and LESS like AI wrote them.

${variations}

For each variation, make these improvements:
1. Replace any remaining corporate/AI language with casual, direct language
2. Add personal touches (e.g., "I tested this with a client last week" or "I've seen this mistake 100 times")
3. Make the hook more conversational and punchy
4. Ensure every line is SHORT (5-12 words). Break up any long sentences.
5. Remove any words that feel like filler or fluff
6. Make sure it doesn't start with a cliche
7. The CTA at the end should feel natural, not forced
8. Add a subtle personality — maybe a dash of humor or a bold opinion
9. Make sure no two consecutive lines start with the same word
10. Remove em-dashes (—) and replace with periods or line breaks

The goal: if someone reads this, they should think "this person actually talks like this" not "AI wrote this."

Return all 3 humanized variations in the same format:
VARIATION 1:
[humanized post]

VARIATION 2:
[humanized post]

VARIATION 3:
[humanized post]`;

  return await callGemini(prompt);
}

// ─── Step 6: Pick the best version ───

async function pickBestVersion(humanizedVariations: string, topic: string): Promise<string> {
  const prompt = `You are a LinkedIn content strategist. Review these 3 post variations and pick the BEST one:

${humanizedVariations}

EVALUATION CRITERIA:
1. Hook strength — will it make someone stop scrolling?
2. Value density — does every line add value or move the reader forward?
3. Human feel — does it sound like a real person wrote it?
4. Specificity — are the tips concrete and actionable, not vague?
5. CTA appeal — would someone actually comment the keyword?
6. Flow — does it read smoothly from top to bottom?
7. Business focus — is it framed around business outcomes, not technology?

Pick the best variation. Then improve it one final time:
- Tighten the hook even more
- Make sure every single line is punchy and adds value
- Ensure the CTA feels natural and compelling
- Check that it's 200-400 words
- Make sure there are NO AI-sounding words

Respond in this format:
BEST_POST:
[the final, polished post content]`;

  return await callGemini(prompt);
}

// ─── Step 7: Final quality review ───

async function qualityReview(post: string, topic: string): Promise<string> {
  const prompt = `You are doing a final quality review on this LinkedIn post before it goes live.

POST:
${post}

CHECK ALL OF THESE:
1. Does every line have only ONE thought? (no run-on sentences)
2. Are there any AI-sounding words? (delve, landscape, harness, unleash, robust, paradigm, synergy, leverage, tapestry, game-changer, thrilled, excited to announce) — REMOVE THEM
3. Does it mention any model names, version numbers, APIs, or technical jargon? — REMOVE THEM
4. Is the hook compelling enough to stop someone mid-scroll?
5. Does it end with a clear CTA using Connect + Comment format?
6. Is it between 200-400 words?
7. Does it sound like a real marketing professional, not an AI?
8. Is every tip/step specific and actionable?
9. Are there any em-dashes (—)? Replace with periods.
10. Do any consecutive lines start with the same word?
11. Is there any corporate buzzword language?
12. Would a business owner find this valuable?

If ANYTHING needs fixing, fix it. Return the final clean version.

Respond with ONLY the final post text. No labels, no explanations.`;

  return await callGemini(prompt);
}

// ─── Step 8: Generate image prompt ───

async function generateImagePrompt(post: string, topic: string): Promise<string> {
  const prompt = `Create an image generation prompt for a LinkedIn post visual.

The post is about: "${topic}"

POST CONTENT:
${post}

Create a prompt that will generate a CLEAN, PROFESSIONAL image like a Notion template or Canva design.

IMAGE REQUIREMENTS:
- Clean, minimal design on a soft gradient or solid background
- Bold, readable typography as the main visual element
- Include the key headline or main stat from the post as large text
- 3-5 short bullet points or numbered steps as visual text overlays
- Use modern, clean sans-serif fonts
- Color palette: soft gradients (light purple to blue, or warm orange to pink, or dark navy to teal)
- Include simple geometric shapes or subtle icons as decorative elements
- Include "Allen Anant Thomas" as small branding text at the bottom
- Layout should look like a professional marketing slide or infographic
- NOT a stock photo. NOT a realistic scene. NOT AI-generated faces.
- Think: Notion cover image, Canva template, modern presentation slide
- Clean white or light text on gradient background
- Professional and shareable. Something a business owner would save.

Respond with ONLY the image generation prompt. Nothing else.`;

  return await callGemini(prompt);
}

// ─── Main: Multi-step content generation pipeline ───

export async function generateLinkedInPost(
  research: ResearchData,
  shouldIncludeImage: boolean
): Promise<GeneratedPost> {
  const recentPosts = await getRecentPosts(5);
  const recentTopics = recentPosts.map((p: any) => p.content?.slice(0, 100)).join("\n");

  // Step 1: Pick the best topic from research
  console.log("  [1/7] Picking topic...");
  const topic = await pickTopic(research, recentTopics);
  console.log(`  Topic: ${topic}`);

  // Step 2: Research similar high-performing posts
  console.log("  [2/7] Researching similar posts...");
  const similarPosts = await researchSimilarPosts(topic);

  // Step 3: Brainstorm value to provide
  console.log("  [3/7] Brainstorming value...");
  const valueIdeas = await brainstormValue(topic, similarPosts);

  // Step 4: Generate 3 variations
  console.log("  [4/7] Generating 3 variations...");
  const variations = await generateVariations(topic, valueIdeas);

  // Step 5: Humanize all variations
  console.log("  [5/7] Humanizing content...");
  const humanizedVariations = await humanizeVariations(variations);

  // Step 6: Pick the best version
  console.log("  [6/7] Selecting best version...");
  const bestRaw = await pickBestVersion(humanizedVariations, topic);
  const bestMatch = bestRaw.match(/BEST_POST:\s*([\s\S]*?)$/);
  const bestPost = bestMatch?.[1]?.trim() || bestRaw.trim();

  // Step 7: Final quality review
  console.log("  [7/7] Quality review...");
  const finalPost = await qualityReview(bestPost, topic);

  // Generate image prompt
  let imagePrompt: string | null = null;
  if (shouldIncludeImage) {
    console.log("  Generating image prompt...");
    imagePrompt = await generateImagePrompt(finalPost, topic);
  }

  return {
    topic: topic.slice(0, 100),
    content: finalPost,
    imagePrompt,
  };
}

async function callGemini(prompt: string): Promise<string> {
  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");
    return text.trim();
  } catch (err: any) {
    console.error(`Gemini API call failed: ${err.message}`);
    throw new Error("Failed to generate content via Gemini API.");
  }
}
