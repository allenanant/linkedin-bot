import { execFileSync } from "child_process";
import { getRecentPosts } from "../storage/db";
import type { ImageData } from "./image-renderer";
import { fetchLinkedInPosts, fetchCompetitorLinkedInPosts } from "../research/linkedin-posts";
import { config } from "../config";

export type { ImageData } from "./image-renderer";

export interface ResearchData {
  trendingTopics: { keyword: string; relatedQueries: string[] }[];
  dailyTrends: string[];
  newsArticles: { title: string; description: string; source: string }[];
  competitorMentions: { title: string; description: string; source: string }[];
  redditDiscussions?: { title: string; selftext: string; score: number; numComments: number; subreddit: string; permalink: string; url: string }[];
  youtubeTopics?: { title: string; channelName: string; viewCount: number; publishedAt: string; topComments: string[]; videoId: string }[];
  socialSearchResults?: { title: string; snippet: string; link: string; source: "twitter" | "quora" }[];
}

export interface GeneratedPost {
  content: string;
  imageData: ImageData | null;
  topic: string;
}

// ─── Step 1a: Pick a NEWS topic ───

async function pickNewsTopic(research: ResearchData, recentTopics: string): Promise<string> {
  const prompt = `You are picking a LinkedIn post topic for Allen Anant Thomas, founder of The Growth Engine, an AI-powered growth agency.

Allen shares AI marketing news, updates, tips, and practical value with his audience. He's knowledgeable, helpful, and genuinely wants to help people understand how AI is changing marketing. He's not trying to be controversial or attack anyone.

Your job: Find the SINGLE most interesting and useful AI marketing news story to share.

RECENT NEWS:
${research.newsArticles.slice(0, 10).map((a) => `- ${a.title} (${a.source}): ${a.description}`).join("\n")}

TRENDING TOPICS:
${research.trendingTopics.map((t) => `- ${t.keyword}: ${t.relatedQueries.join(", ")}`).join("\n")}

DAILY TRENDS:
${research.dailyTrends.join(", ")}

INDUSTRY MENTIONS:
${research.competitorMentions.slice(0, 5).map((a) => `- ${a.title} (${a.source}): ${a.description}`).join("\n")}

AVOID THESE (already posted recently):
${recentTopics || "None yet"}

RULES:
1. Pick a SPECIFIC news story. Name the company, tool, or event. No vague "AI is changing marketing."
2. Frame it as: what happened + why it matters for marketers/business owners + what they should do about it.
3. The angle should be HELPFUL. "Here's what this means for you" not "here's why everyone is wrong."
4. It should make a business owner stop scrolling and think "I need to know about this."
5. If no clear AI marketing news exists, pick the closest tech/business story and connect it to marketing with a useful angle.

Respond with ONLY the topic in 1-2 sentences. Frame it as: what happened + why it matters. Nothing else.`;

  return await callGemini(prompt);
}

// ─── Step 1b: Analyze research & find the best topic (freebie/default) ───

async function pickTopic(research: ResearchData, recentTopics: string): Promise<string> {
  const redditSection = research.redditDiscussions?.length
    ? `\nREDDIT DISCUSSIONS — HIGHEST PRIORITY. These are REAL people asking REAL questions right now:
${research.redditDiscussions
  .slice(0, 10)
  .map(
    (r) =>
      `- r/${r.subreddit} [${r.score} upvotes, ${r.numComments} comments]: "${r.title}"${
        r.selftext ? `\n  Context: ${r.selftext.slice(0, 200)}` : ""
      }`
  )
  .join("\n")}`
    : "";

  const youtubeSection = research.youtubeTopics?.length
    ? `\nYOUTUBE TRENDING — what people are watching and discussing RIGHT NOW:
${research.youtubeTopics
  .slice(0, 8)
  .map(
    (v) =>
      `- "${v.title}" by ${v.channelName} [${formatViewCount(v.viewCount)} views]${
        v.topComments.length
          ? `\n  Top comments: ${v.topComments.slice(0, 3).map((c) => `"${c.slice(0, 100)}"`).join(" | ")}`
          : ""
      }`
  )
  .join("\n")}`
    : "";

  const socialSection = research.socialSearchResults?.length
    ? `\nTWITTER/QUORA DISCUSSIONS:
${research.socialSearchResults
  .slice(0, 5)
  .map((s) => `- [${s.source}] "${s.title}": ${s.snippet.slice(0, 150)}`)
  .join("\n")}`
    : "";

  const prompt = `You are picking a LinkedIn post topic for Allen Anant Thomas, founder of The Growth Engine, an AI-powered growth agency.

ALLEN'S CONTENT STYLE:
- Conversational, like talking to a friend. Stream-of-consciousness, not polished copywriting.
- Uses casual language: "lol", "this kind of shit", "badass", "to be very honest"
- Natural transitions: "You know what...", "Well,", "To be very honest"
- Self-deprecating/humble: "I was not aware of all this" not "Here's what I learned"
- Tells stories of discovery, not lectures. He's sharing what he found, not teaching from a podium.
- Audience: Business owners, founders, marketers who want practical AI knowledge.
- PRIMARY topics: AI news + use cases. "Here's something new, and here's exactly how you can use it."
- SECONDARY topics (max 1 in 3 days): Marketing/agency advice.
- Allen is pro-Claude/Anthropic. Never hype OpenAI/GPT. Gemini is fine to mention.
- Every post MUST end with a lead magnet CTA: offer a free document/guide + "Connect with me" + "Comment [keyword] so I can send it"

Your job: Find the SINGLE most useful and interesting topic for a LinkedIn post.
${redditSection}
${youtubeSection}
${socialSection}

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

TOPIC SELECTION RULES:
1. PRIORITY: AI news + use cases. What's NEW in AI this week? What can you BUILD with it? Allen's audience loves "here's something new, and here's exactly how you can use it."
2. SECOND: Reddit discussions about AI tools, automation, building things. Real people experimenting = content gold.
3. THIRD: Cross-reference with YouTube and social for trending AI topics.
4. The topic MUST fit one of these angles:
   a. AI NEWS + USE CASE: A specific AI launch/update + "here's what you can actually do with it" (THIS IS THE PRIMARY ANGLE)
   b. BUILD SOMETHING COOL: A specific thing Allen built or discovered with AI tools (Claude Code, automation, etc.)
   c. TOOL DISCOVERY: A new AI tool or feature + practical walkthrough of how to use it
   d. MARKETING/AGENCY TIP: Only if no good AI news exists. Max 1 in 3 posts.
5. Be SPECIFIC. Name the tool, the model, the feature. Not vague "AI is changing everything."
6. IMPORTANT: Allen is pro-Claude/Anthropic. Prioritize Claude/Anthropic news. Never hype OpenAI/GPT models. Gemini is fine.
7. Always think: "what's the USE CASE?" - don't just report news, show how it's useful.

Respond with ONLY the topic in 1-2 sentences. Include the angle. Nothing else.`;

  return await callGemini(prompt);
}

function formatViewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

// ─── Step 2: Research similar high-performing posts (REAL data) ───

async function researchSimilarPosts(topic: string): Promise<string> {
  const { apiKey, searchEngineId } = config.socialSearch;

  const [topicPosts, competitorPosts] = await Promise.all([
    fetchLinkedInPosts(apiKey, searchEngineId, topic, 8),
    fetchCompetitorLinkedInPosts(apiKey, searchEngineId),
  ]);

  const allPosts = [...topicPosts, ...competitorPosts];

  const realPostsSection = allPosts.length > 0
    ? allPosts
        .slice(0, 15)
        .map((p, i) => `${i + 1}. [${p.author}] "${p.title}"\n   Snippet: ${p.snippet}\n   URL: ${p.link}`)
        .join("\n\n")
    : "No real posts found via search. Use your knowledge of top LinkedIn creators instead.";

  const prompt = `You are a LinkedIn content researcher. I'm writing a post about: "${topic}"

REAL LINKEDIN POSTS I found on this topic and from top creators:

${realPostsSection}

Based on these REAL posts, analyze:

1. HOOKS THAT WORKED — What opening lines grabbed attention? What made people stop scrolling?

2. STRUCTURE PATTERNS — How did the best posts structure their content? Stories? Step-by-step? Data breakdowns?

3. ENGAGEMENT PATTERNS — How did they drive comments? Questions? Sharing useful resources? Asking for experiences?

4. WHAT'S MISSING — What useful angle on "${topic}" are these posts NOT covering? What practical insight could Allen add?

5. SPECIFIC ELEMENTS:
   - The most effective hook pattern from the posts above
   - The best structural format for THIS topic
   - What practical resource or tip would make this post genuinely useful
   - What question would get people sharing their own experience

Be specific. Reference the actual posts above when making recommendations.`;

  return await callGemini(prompt);
}

// ─── Step 3: Brainstorm value to provide ───

async function brainstormValue(topic: string, similarPosts: string): Promise<string> {
  const prompt = `Brainstorming a LinkedIn post for Allen Anant Thomas about: "${topic}"

Allen runs The Growth Engine, an AI-powered growth agency. He shares practical AI marketing knowledge. He's helpful, genuine, and wants to educate his audience. He doesn't put others down or attack anyone.

Research on what works:
${similarPosts}

Brainstorm these SPECIFIC things:

1. HOOKS — Write 5 different opening lines, each under 12 words. Types:
   a. Curiosity: "I just found an AI workflow that cuts ad copy time by 80%."
   b. News: "Claude just released something that changes how we do marketing."
   c. Useful number: "3 AI tools I use every day that save me 4 hours."
   d. Question: "Are you still writing all your ad copy manually?"
   e. Surprising insight: "The AI feature most marketers are ignoring is the most powerful one."

2. REHOOK — For each hook, write the second line that keeps people reading. It should:
   - Tease the value they'll get
   - Add context that makes them curious
   - Promise a specific, useful takeaway

3. VALUE — What's the actual MEAT of the post? Pick ONE:
   a. 3-5 practical steps someone can do today
   b. A specific AI prompt or workflow they can copy
   c. A news breakdown with "what this means for you"
   d. A real example or result with the process behind it

4. CTA — Pick ONE of these ending styles:
   a. QUESTION: Ask something that gets people sharing their experience. "What AI tools are you using for [X]?"
   b. HELPFUL OFFER: "I'll share the full workflow with anyone who's interested. Just drop a comment."
   c. DISCUSSION: "Would love to hear how others are handling this."
   d. SIMPLE: Just end with a useful final thought. No ask needed.

5. EXTRA VALUE — What free resource, template, or tip could make this post worth saving/sharing?

Think like someone who genuinely wants to help their audience succeed.`;

  return await callGemini(prompt);
}

// ─── Step 4: Generate 3 post variations ───

async function generateVariations(topic: string, valueIdeas: string): Promise<string> {
  const prompt = `Write 3 LinkedIn post variations for Allen Anant Thomas about: "${topic}"

Value ideas to use:
${valueIdeas}

═══ ALLEN'S VOICE ═══
Allen is the founder of The Growth Engine. He writes like he's talking to a friend, not writing a blog post. Casual, personal, stream-of-consciousness. He shares discoveries, not lectures.

How Allen ACTUALLY sounds:
- "You know what most founders think automation is? The thing that's replacing people. Well, it's not lol"
- "I was not aware of all this, but I came to know that I can do this kind of shit and build such badass things"
- "To be very honest, it's way smarter than you are, so it would already predict what you're doing"
- "You know what? How I start my day. I start my day with a command line."
- "Well, why do I just keep it to myself? I thought I could share this small value with you all as well."

How Allen does NOT sound:
- "I've been testing this AI workflow for 2 weeks. The results surprised me." (too clean, too copywriter)
- "Start small. Prove the ROI. Then scale." (power sentences are banned)
- "Most people don't know about this feature." (generic thought leader voice)

EVERY post MUST end with:
- A lead magnet offer (free document, guide, walkthrough, checklist)
- "1. Connect with me"
- "2. Comment [keyword] so I can send it to your inbox"

═══ POST STRUCTURE ═══
LinkedIn shows only 3 lines before "see more." Make those 3 lines count.

LINE 1 — THE HOOK: Under 12 words. Create curiosity, share a useful finding, or tease valuable info.

LINE 2 — BLANK LINE

LINE 3 — THE FOLLOW-UP: Add context that makes them want to read more. Tease the value inside.

LINE 4+ — THE MEAT: Deliver the actual value. Each variation MUST use a DIFFERENT structure:
- VARIATION 1: Numbered practical steps. 3-5 steps, each 1-2 short lines.
- VARIATION 2: Story format. A real experience with what happened, what was learned, and what to do.
- VARIATION 3: News/insight format. Break down what happened, why it matters, and what to do about it.

LAST 2-3 LINES — THE ENDING:
Pick a DIFFERENT ending for each variation:
a. A genuine question that invites discussion
b. An offer to share more details or resources
c. A simple, useful closing thought

═══ FORMATTING RULES ═══
- One thought per line. NEVER more than 15 words on a single line.
- Good use of line breaks. Easy to scan.
- NO indentation. NO tabs. Every line starts at the left margin.
- NO parentheses () anywhere. LinkedIn truncates them. Use periods instead.
- NO hashtags. NO emojis in the first 3 lines.
- NO markdown. Plain text only.
- Single space after numbers: "1. " not "1.  "
- Plain quotes only — no smart/curly quotes.
- 150-300 words per variation.

═══ BANNED WORDS ═══
NEVER use: leverage, synergy, game-changer, delve, landscape, tapestry, unleash, harness, paradigm, robust, thrilled, excited to announce, in today's fast-paced world, buckle up, let that sink in, here's the thing, without further ado, at the end of the day, navigate, elevate, foster, facilitate, revolutionize, skyrocket, supercharge

═══ CONTENT RULES ═══
- Practical outcomes: time saved, better results, costs reduced.
- Be SPECIFIC: name the tools, share the numbers, describe the steps.
- Every tip must be something they can DO today.
- NO putting others down. NO "most marketers are doing it wrong" framing.
- NO aggressive, rude, or condescending language.
- Tone: helpful expert, not edgy provocateur.
- It's OK to mention AI model names or tools when they're the news/topic itself.

Each variation needs a DIFFERENT hook, DIFFERENT structure, DIFFERENT ending.

Format:
VARIATION 1:
[post]

VARIATION 2:
[post]

VARIATION 3:
[post]`;

  return await callGemini(prompt);
}

// ─── Step 5: Humanize all variations ───

async function humanizeVariations(variations: string): Promise<string> {
  const prompt = `You are Allen's editor. Allen Anant Thomas is a young agency founder who's genuine, helpful, and talks like a real person. NOT like a LinkedIn influencer. NOT like ChatGPT.

Here are 3 LinkedIn post drafts that need to sound natural:

${variations}

═══ ALLEN'S VOICE CHECKLIST ═══
Allen writes like voice notes, not blog posts. If it sounds polished, it's wrong. Allen sounds like:
- Someone telling a friend about something cool he discovered
- Casual: "lol", "to be very honest", "you know what", "this kind of shit"
- Self-deprecating: "I was not aware of this" not "Here's what I learned"
- He gives credit to tools: "it's way smarter than you are"
- He uses "Well," and "You know what?" as transitions
- He doesn't use power sentences like "Start small. Prove the ROI. Then scale."

═══ FIXES TO MAKE ═══
1. Kill corporate speak AND copywriter speak. No polished one-liners.
2. Add casual transitions: "Well,", "You know what?", "To be very honest", "And honestly..."
3. Make it sound like a voice note. Read it out loud - if it sounds written, rewrite it.
4. Every line: max 15 words. If longer, break it.
5. Add personal discovery moments: "I came to know that...", "I was playing with this and..."
6. Replace em-dashes with periods or line breaks.
7. The ending MUST be a lead magnet CTA: free resource + "Connect with me" + "Comment [keyword]"
8. Add at least 2-3 personal touches per post. Specific details from Allen's experience.
9. It's OK to use "lol" once or twice. It's Allen's natural voice.

═══ AI DETECTION ═══
If ANY line sounds AI-generated OR like a LinkedIn copywriter, rewrite it. Red flags:
- Clean power sentences: "The trick isn't X. It's Y." (BANNED)
- Starting with "In today's..." or "As a..."
- Lists where every item follows the exact same sentence structure
- Overly balanced statements. Allen has strong preferences (pro-Claude, anti-OpenAI).
- Perfect grammar everywhere. Allen uses fragments, "lol", casual phrasing.
- Generic hooks like "Most people don't know..." or "Here's what nobody tells you..."

Return all 3 humanized variations:
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
  const prompt = `Pick the BEST of these 3 LinkedIn posts and make it perfect:

${humanizedVariations}

═══ SCORING — rank each post 1-10 on: ═══
1. HOOK: Would you stop scrolling? Is it under 12 words? Does it make you curious?
2. VALUE: Does this post teach something genuinely useful? Would someone save or share it?
3. AUTHENTICITY: Does it sound like a real person wrote it? Or like AI?
4. SPECIFICITY: Are there real details, real steps, real examples?
5. TONE: Is it helpful and genuine? Not preachy, condescending, or aggressive?
6. ENGAGEMENT: Would someone want to comment with their own experience or ask a question?

═══ PICK THE WINNER AND POLISH IT ═══
Take the best variation and make these final tweaks:
- If the hook can be shorter, make it shorter
- If any line is filler, delete it
- If any line sounds like AI, rewrite it naturally
- Make sure the post is 150-300 words. Tight. No padding.
- The ending should feel genuine, not forced
- Make sure the tone is helpful and humble throughout. Remove anything that sounds preachy or aggressive.

Respond in this format:
BEST_POST:
[the final polished post]`;

  return await callGemini(prompt);
}

// ─── Step 7: Final quality review ───

async function qualityReview(post: string, topic: string): Promise<string> {
  const prompt = `You are a copy editor. Apply these fixes to this LinkedIn post and return ONLY the corrected post text.

POST TO FIX:
${post}

FIXES TO APPLY:
- Remove any indentation, tabs, or leading spaces from every line
- Max 15 words per line. Break longer lines.
- Remove all markdown: **bold**, *italic*, #headers, [links]()
- Replace parentheses () with periods
- Replace em-dashes with periods or line breaks
- Fix double spaces after numbers: "1. " not "1.  "
- Replace smart/curly quotes with plain quotes
- Max 2 blank lines between sections
- Remove these AI words if present: delve, landscape, harness, unleash, robust, paradigm, synergy, leverage, tapestry, game-changer, thrilled, excited to announce, let that sink in, here's the thing, buckle up, at the end of the day, navigate, elevate, foster, facilitate, revolutionize, skyrocket, supercharge
- No two consecutive lines should start with the same word
- Remove anything preachy, condescending, or aggressive
- Keep it 150-300 words

CRITICAL: Your ENTIRE response must be the corrected post text and NOTHING else.
Do NOT include any commentary, review notes, issue lists, or explanations.
Do NOT start with "Here's the corrected..." or "A few issues..." or any preamble.
Just output the post text, ready to publish.`;

  const reviewed = await callGemini(prompt);

  // Safety: if Claude returned review notes instead of the post, fall back to original
  const looksLikeReview = /^(a few issues|here are the|issues? (to |found)|fixes? (needed|applied)|review:|problems?:)/i.test(reviewed.trim());
  if (looksLikeReview) {
    console.log("  [QualityReview] Got review notes instead of clean post. Using pre-review version.");
    return post;
  }

  return stripMarkdown(reviewed);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/`(.+?)`/g, "$1");
}

export function cleanForLinkedIn(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^[ \t]+/gm, "")
    .replace(/^(\d+\.)\s{2,}/gm, "$1 ")
    .replace(/\(([^)]*)\)/g, "$1")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, ".")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Step 8: Extract image data for freebie card ───

async function extractFreebieImageData(post: string, topic: string): Promise<ImageData> {
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

  const headlineMatch = extracted.match(/HEADLINE:\s*(.+)/);
  const subtitleMatch = extracted.match(/SUBTITLE:\s*(.+)/);
  const points: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const m = extracted.match(new RegExp(`POINT${i}:\\s*(.+)`));
    if (m) {
      const words = m[1].trim().split(/\s+/).slice(0, 5).join(" ");
      points.push(words);
    }
  }

  return {
    type: "freebie",
    headline: headlineMatch?.[1]?.trim().split(/\s+/).slice(0, 6).join(" ") || topic.slice(0, 30),
    subtitle: subtitleMatch?.[1]?.trim().split(/\s+/).slice(0, 8).join(" ") || "A practical framework",
    points,
  };
}

// ─── Step 8b: Extract image data for NEWS-style card ───

async function extractNewsImageData(post: string, topic: string): Promise<ImageData> {
  const extractPrompt = `From this LinkedIn post about an AI marketing news story, extract VERY SHORT text for a news-style image:

POST:
${post}

RULES:
- HEADLINE must be 4-7 words MAXIMUM. Like a news headline.
- SUBTITLE must be under 10 words. A brief supporting line.
- CATEGORY should be 2-3 words like "AI MARKETING", "AD TECH", "MARTECH", "AI SALES", "GROWTH AI"

Respond in this EXACT format:
HEADLINE: [4-7 words]
SUBTITLE: [under 10 words]
CATEGORY: [2-3 words]`;

  const extracted = await callGemini(extractPrompt);

  const headlineMatch = extracted.match(/HEADLINE:\s*(.+)/);
  const subtitleMatch = extracted.match(/SUBTITLE:\s*(.+)/);
  const categoryMatch = extracted.match(/CATEGORY:\s*(.+)/);

  return {
    type: "news",
    headline: headlineMatch?.[1]?.trim().split(/\s+/).slice(0, 8).join(" ") || topic.slice(0, 40),
    subtitle: subtitleMatch?.[1]?.trim().split(/\s+/).slice(0, 10).join(" ") || "What this means for your business",
    category: categoryMatch?.[1]?.trim().split(/\s+/).slice(0, 3).join(" ") || "AI MARKETING",
  };
}

// ─── Main: Multi-step content generation pipeline ───

export async function generateLinkedInPost(
  research: ResearchData,
  shouldIncludeImage: boolean,
  postType: "news" | "freebie" = "freebie"
): Promise<GeneratedPost> {
  const recentPosts = await getRecentPosts(5);
  const recentTopics = recentPosts.map((p: any) => p.content?.slice(0, 100)).join("\n");

  console.log(`  [1/7] Picking topic (${postType} mode)...`);
  const topic = postType === "news"
    ? await pickNewsTopic(research, recentTopics)
    : await pickTopic(research, recentTopics);
  console.log(`  Topic: ${topic}`);

  console.log("  [2/7] Researching similar posts...");
  const similarPosts = await researchSimilarPosts(topic);

  console.log("  [3/7] Brainstorming value...");
  const valueIdeas = await brainstormValue(topic, similarPosts);

  console.log("  [4/7] Generating 3 variations...");
  const variations = await generateVariations(topic, valueIdeas);

  console.log("  [5/7] Humanizing content...");
  const humanizedVariations = await humanizeVariations(variations);

  console.log("  [6/7] Selecting best version...");
  const bestRaw = await pickBestVersion(humanizedVariations, topic);
  const bestMatch = bestRaw.match(/BEST_POST:\s*([\s\S]*?)$/);
  const bestPost = bestMatch?.[1]?.trim() || bestRaw.trim();

  console.log("  [7/7] Quality review...");
  const reviewedPost = await qualityReview(bestPost, topic);

  const finalPost = cleanForLinkedIn(reviewedPost);

  let imageData: ImageData | null = null;
  if (shouldIncludeImage) {
    console.log(`  Extracting image data (${postType} template)...`);
    imageData = postType === "news"
      ? await extractNewsImageData(finalPost, topic)
      : await extractFreebieImageData(finalPost, topic);
  }

  return {
    topic: topic.slice(0, 100),
    content: finalPost,
    imageData,
  };
}

async function callGemini(prompt: string): Promise<string> {
  try {
    const result = execFileSync(
      "claude",
      ["-p", "--model", "opus", "--output-format", "text"],
      {
        input: prompt,
        encoding: "utf-8",
        timeout: 300_000,
        maxBuffer: 2 * 1024 * 1024,
      }
    );
    const text = result.trim();
    if (!text) throw new Error("Empty response from Claude CLI");
    return text;
  } catch (err: any) {
    console.error(`Claude CLI call failed: ${err.message}`);
    throw new Error("Failed to generate content via Claude CLI.");
  }
}
