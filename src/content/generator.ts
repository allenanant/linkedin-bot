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
- Use numbered lists (1. 2. 3.) or arrow symbols (↳) for actionable steps
- Short punchy sentences. 5-12 words per line.
- ALWAYS end with: "1. Connect with me (so I can DM you) 2. Comment '[KEYWORD]' and I'll send you [something valuable]."
- Use keywords like 'GROWTH', 'MARKETING', 'AI', 'SALES', 'STRATEGY', 'LEADS', 'REVENUE'
- NO hashtags ever.
- 200-400 words per variation.

CRITICAL LINKEDIN FORMATTING RULES:
- NEVER use indentation or leading spaces on ANY line. Every line must start at the left margin.
- NEVER use tab characters.
- For numbered lists with sub-points, put each sub-point on its own line WITHOUT indentation.
- Use "1." not "1.  " (single space after the period, never double).
- NEVER use parentheses () anywhere in the post. LinkedIn truncates posts that contain parentheses. Instead of "Protect Data (For Real)" write "Protect Data. For Real."
- Use only plain double quotes " not smart/curly quotes.
- Use only plain single quotes ' not smart/curly quotes.

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
13. CRITICAL: Remove ALL markdown formatting. No **bold**, no *italic*, no #headers, no [links](). LinkedIn does NOT support markdown. Use PLAIN TEXT ONLY.
14. CRITICAL: Does ANY line start with spaces, tabs, or indentation? REMOVE ALL leading whitespace. Every single line MUST start at the left margin with no spaces before it. LinkedIn SILENTLY TRUNCATES posts with indented lines.
15. Are there double spaces after numbers like "1.  "? Change to single space "1. ".
16. CRITICAL: Are there ANY parentheses () ANYWHERE in the post? Remove ALL parentheses. LinkedIn TRUNCATES posts containing parentheses. Replace "something (detail)" with "something. detail" or "something - detail".
17. Are there smart/curly quotes? Replace with plain quotes.

If ANYTHING needs fixing, fix it. Return the final clean version.

Respond with ONLY the final post text. No labels, no explanations.`;

  const reviewed = await callGemini(prompt);
  return stripMarkdown(reviewed);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")   // **bold** → bold
    .replace(/\*(.+?)\*/g, "$1")        // *italic* → italic
    .replace(/__(.+?)__/g, "$1")        // __bold__ → bold
    .replace(/_(.+?)_/g, "$1")          // _italic_ → italic
    .replace(/^#{1,6}\s+/gm, "")        // # headers → plain text
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // [text](url) → text
    .replace(/`(.+?)`/g, "$1");         // `code` → code
}

// LinkedIn SILENTLY TRUNCATES posts that contain parentheses or indented lines.
// This function strips all problematic formatting.
export function cleanForLinkedIn(text: string): string {
  return text
    // Strip markdown first
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    // Remove ALL leading whitespace from every line (tabs, spaces)
    .replace(/^[ \t]+/gm, "")
    // Fix double spaces after numbers: "1.  " → "1. "
    .replace(/^(\d+\.)\s{2,}/gm, "$1 ")
    // CRITICAL: Remove parentheses — LinkedIn truncates at ( characters
    .replace(/\(([^)]*)\)/g, "$1")
    // Replace smart/curly quotes with plain quotes
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Remove em-dashes
    .replace(/\u2014/g, ".")
    // Collapse 3+ consecutive newlines into 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Step 8: Generate image prompt ───

async function generateImagePrompt(post: string, topic: string): Promise<string> {
  // Extract the main headline and key points from the post for the image
  const extractPrompt = `From this LinkedIn post, extract VERY SHORT text for an image:

POST:
${post}

RULES:
- HEADLINE must be 3-5 words MAXIMUM. Like a book title.
- SUBTITLE must be under 8 words. One short phrase.
- Each POINT must be EXACTLY 2-4 words. NO full sentences. NO colons. NO explanations.
  Good examples: "Set spending limits", "Filter sensitive data", "Track AI costs", "Automate reports"
  Bad examples: "Stop Budget Bleed Cold: Identify inefficient AI spend" (TOO LONG)

Respond in this EXACT format:
HEADLINE: [3-5 words]
SUBTITLE: [under 8 words]
POINT1: [2-4 words]
POINT2: [2-4 words]
POINT3: [2-4 words]
POINT4: [2-4 words]`;

  const extracted = await callGemini(extractPrompt);

  // Parse the extracted content
  const headlineMatch = extracted.match(/HEADLINE:\s*(.+)/);
  const subtitleMatch = extracted.match(/SUBTITLE:\s*(.+)/);
  const points: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const m = extracted.match(new RegExp(`POINT${i}:\\s*(.+)`));
    if (m) {
      // Force truncate to max 5 words as safety net
      const words = m[1].trim().split(/\s+/).slice(0, 5).join(" ");
      points.push(words);
    }
  }

  const headline = headlineMatch?.[1]?.trim().split(/\s+/).slice(0, 6).join(" ") || topic.slice(0, 30);
  const subtitle = subtitleMatch?.[1]?.trim().split(/\s+/).slice(0, 8).join(" ") || "A practical framework";

  // Build a very specific Notion-style mockup prompt
  const imagePrompt = `Create a screenshot mockup of a Notion-style productivity app page. The image should look EXACTLY like a real macOS app window screenshot:

LAYOUT:
- macOS window frame at the top with the three colored dots (red, yellow, green) in top-left corner
- A clean LEFT SIDEBAR (light gray background, about 20% width) with 4-5 navigation items listed vertically using small icons and text labels like: "Content Strategy", "Projects", "Research", "Analytics", "${headline}"
- The current page "${headline}" should be highlighted/active in the sidebar
- MAIN CONTENT AREA (white background, 80% width) with:
  - Large bold black headline text: "${headline}"
  - Smaller gray subtitle text below: "${subtitle}"
  - A numbered list with 4 items: 1. ${points[0] || "First step"} 2. ${points[1] || "Second step"} 3. ${points[2] || "Third step"} 4. ${points[3] || "Fourth step"}

STYLE:
- Clean, minimal, professional — looks like a real Notion page or productivity app
- White main background, light gray sidebar
- Black text, clean sans-serif typography (like Inter or SF Pro)
- NO gradients, NO colorful backgrounds, NO decorative elements
- NO AI-generated textures or patterns
- Crisp, sharp, high contrast — like an actual app screenshot
- The overall feel should be: clean, organized, professional tool
- Think: Notion, Linear, or Obsidian page screenshot
- Aspect ratio: landscape (16:9)`;

  return imagePrompt;
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
  const reviewedPost = await qualityReview(bestPost, topic);

  // Step 8: Code-level safety net — clean for LinkedIn
  const finalPost = cleanForLinkedIn(reviewedPost);

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
