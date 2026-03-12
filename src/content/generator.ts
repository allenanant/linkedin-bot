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

// ─── Step 1a: Pick a NEWS topic (AI in marketing news) ───

async function pickNewsTopic(research: ResearchData, recentTopics: string): Promise<string> {
  const prompt = `You are picking a LinkedIn post topic for Allen Anant Thomas — founder of The Growth Engine, an AI-powered full-stack growth agency. Allen's brand is: bold, opinionated, data-backed, and anti-bullshit. He believes strategy is overrated, speed wins, and most marketers use AI to create garbage instead of using it as a weapon.

Your job: Find the SINGLE most provocative AI marketing news story that Allen can write a HOT TAKE about.

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
2. Frame it as a CONTRARIAN HOT TAKE. What does Allen think about this that would make people argue in the comments?
3. The take should be bold enough to polarize — some people agree, some disagree. That's the goal.
4. It should make a business owner stop scrolling and think "wait, what? I need to read this."
5. If no clear AI marketing news exists, pick the closest tech/business story and connect it to marketing with a spicy angle.

Respond with ONLY the topic in 1-2 sentences. Frame it as: what happened + Allen's contrarian take on it. Nothing else.`;

  return await callGemini(prompt);
}

// ─── Step 1b: Analyze research & find the best topic (freebie/default) ───

async function pickTopic(research: ResearchData, recentTopics: string): Promise<string> {
  // Build Reddit section — highest-value signal for real pain points
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

  // Build YouTube section
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

  // Build social search section
  const socialSection = research.socialSearchResults?.length
    ? `\nTWITTER/QUORA DISCUSSIONS:
${research.socialSearchResults
  .slice(0, 5)
  .map((s) => `- [${s.source}] "${s.title}": ${s.snippet.slice(0, 150)}`)
  .join("\n")}`
    : "";

  const prompt = `You are picking a LinkedIn post topic for Allen Anant Thomas — founder of The Growth Engine, an AI-powered full-stack growth agency.

ALLEN'S BRAND:
- Bold, opinionated, anti-bullshit. Says what others won't.
- Believes: strategy is overrated, speed wins, most marketers use AI wrong.
- Audience: Business owners, founders, marketers who want REAL results, not theory.
- Content style: Contrarian takes, tactical breakdowns, AI tips people can use TODAY.
- Core belief: "Stop overthinking. Ship it. Test it. Fix it."

Your job: Find the SINGLE most compelling topic for a LinkedIn post. The topic should make someone think "damn, I need to stop scrolling and read this."
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
1. FIRST: Reddit discussions. Real people asking real questions = content gold. High upvotes + comments = validated pain point.
2. SECOND: Cross-reference with YouTube and social. If multiple platforms discuss the same problem, that's your topic.
3. The topic MUST fit one of these angles:
   a. CONTRARIAN TAKE: Challenge something everyone believes. "Everyone says X. They're wrong. Here's why."
   b. TACTICAL BREAKDOWN: A specific how-to that gives someone a result. Not theory. Steps they can do in 30 minutes.
   c. AI TIP/HACK: A specific AI workflow, prompt, or tool that saves time or money. Something they can use TODAY.
4. Be BRUTALLY SPECIFIC. Not "how to use AI for marketing." Instead: "I replaced my $3K/month copywriter with a 4-step AI workflow. Here's the exact process."
5. The topic should either make people AGREE STRONGLY or DISAGREE STRONGLY. Lukewarm = no comments.
6. Frame around business outcomes: revenue, leads, time saved, costs cut. Not features or technology.

Respond with ONLY the topic in 1-2 sentences. Include the angle — contrarian, tactical, or AI tip. Nothing else.`;

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

  // Fetch real LinkedIn posts about this topic
  const [topicPosts, competitorPosts] = await Promise.all([
    fetchLinkedInPosts(apiKey, searchEngineId, topic, 8),
    fetchCompetitorLinkedInPosts(apiKey, searchEngineId),
  ]);

  const allPosts = [...topicPosts, ...competitorPosts];

  // Build a section with real post data for AI to analyze
  const realPostsSection = allPosts.length > 0
    ? allPosts
        .slice(0, 15)
        .map((p, i) => `${i + 1}. [${p.author}] "${p.title}"\n   Snippet: ${p.snippet}\n   URL: ${p.link}`)
        .join("\n\n")
    : "No real posts found via search. Use your knowledge of top LinkedIn creators instead.";

  const prompt = `You are a LinkedIn content researcher. I'm writing a post about: "${topic}"

REAL LINKEDIN POSTS I found on this topic and from top creators. Analyze these ACTUAL posts for patterns:

${realPostsSection}

Based on these REAL posts, analyze:

1. HOOKS THAT WORKED — What opening lines did these posts use? What patterns do you see? Which hooks would make someone stop scrolling?

2. STRUCTURE PATTERNS — How did the high-performing posts structure their content? Numbered lists? Stories? Data breakdowns? Single-line punches?

3. CTA PATTERNS — How did they drive engagement? Comment keywords? Questions? Controversial takes?

4. WHAT'S MISSING — What angle on "${topic}" are these posts NOT covering that Allen could own? What contrarian take is nobody making?

5. SPECIFIC ELEMENTS TO STEAL:
   - The most compelling hook pattern from the posts above
   - The best structural format for THIS topic
   - A freebie idea (AI prompt pack, checklist, framework) that people would comment a keyword to get
   - What data point or stat would make someone stop scrolling?
   - The most POLARIZING angle that would spark debate

Be specific and tactical. Reference the actual posts above when making recommendations.`;

  return await callGemini(prompt);
}

// ─── Step 3: Brainstorm value to provide ───

async function brainstormValue(topic: string, similarPosts: string): Promise<string> {
  const prompt = `Brainstorming a LinkedIn post for Allen Anant Thomas about: "${topic}"

Allen's brand: Bold, anti-bullshit, speed-obsessed. Runs The Growth Engine — AI-powered growth agency. Believes overthinking kills businesses and AI is misused by 90% of marketers.

Research on what works:
${similarPosts}

Brainstorm these SPECIFIC things:

1. HOOKS — Write 5 different opening lines, each under 12 words. Types:
   a. Contrarian: "Everyone says X. They're dead wrong."
   b. Curiosity gap: "I found out why X fails. The reason is embarrassing."
   c. Bold claim with a number: "I cut my client's ad spend by 60% with one AI prompt."
   d. Pattern interrupt: Start mid-thought, mid-story, or with a provocative question.
   e. Hot take: "Unpopular opinion: [something that'll make people angry]"

2. REHOOK — For each hook, write the second line that makes it IMPOSSIBLE to scroll past. This line should either:
   - Crush the reader's objection to keep reading
   - Add a surprising twist to the hook
   - Promise a specific, tangible outcome

3. VALUE — What's the actual MEAT of the post? Pick ONE:
   a. 3-5 tactical steps someone can do in 30 minutes
   b. A specific AI prompt or workflow they can copy-paste
   c. A data-backed breakdown that changes how they think
   d. A short story with a twist and a lesson

4. CTA — Pick ONE of these ending styles. DO NOT always use the same one:
   a. QUESTION CTA: End with a genuine question that makes people share their experience. "What's your biggest AI mistake so far?"
   b. OPINION CTA: End with a polarizing statement that forces people to agree or disagree. "If you're still doing X manually, you're leaving money on the table."
   c. STORY CTA: End by asking people to share their own version. "Drop your worst marketing automation horror story below."
   d. RESOURCE CTA: "Want my [specific resource]? Comment [KEYWORD] and I'll send it over." Only use this if the post has a genuinely useful resource to offer. Not every post needs this.
   e. SIMPLE CTA: Just end with a strong final line. No ask. Let the content speak for itself.

5. SPICE — What opinion about this topic would get Allen the most comments? What would people ARGUE about?

Think like a growth marketer who's built real campaigns. Not a content writer.`;

  return await callGemini(prompt);
}

// ─── Step 4: Generate 3 post variations ───

async function generateVariations(topic: string, valueIdeas: string): Promise<string> {
  const prompt = `Write 3 LinkedIn post variations for Allen Anant Thomas about: "${topic}"

Value ideas to use:
${valueIdeas}

═══ ALLEN'S VOICE ═══
Allen is the founder of The Growth Engine. He's bold, witty, and doesn't sugarcoat. He sounds like a smart friend who's built real campaigns, not a LinkedIn guru. He cusses occasionally. He's blunt. He takes stances. He makes you think "this guy actually knows what he's talking about."

Sample of how Allen sounds:
- "Stop strategizing. Start shipping. Your competitor already launched while you were on slide 47."
- "Everyone's using AI to write more mediocre content faster. That's not innovation. That's just faster garbage."
- "I replaced a $5K/month process with a 20-minute AI workflow. My client nearly cried."

═══ POST STRUCTURE — HOOK + REHOOK FORMAT ═══
LinkedIn shows only 3 lines before "see more." Your ENTIRE value proposition lives there.

LINE 1 — THE HOOK: Under 12 words. Must create curiosity, make a bold claim, or say something contrarian. This line alone decides if someone reads or scrolls.

LINE 2 — BLANK LINE

LINE 3 — THE REHOOK: Slams the door behind the reader. Crushes their objection to keep reading. Adds a twist. Makes it IMPOSSIBLE to scroll past.

LINE 4+ — THE MEAT: Deliver the actual value. Each variation MUST use a DIFFERENT structure:
- VARIATION 1: Numbered tactical steps. 3-5 steps, each 1-2 short lines.
- VARIATION 2: Story format. A real mini-story with a twist, lesson, and personal touch. NO numbered lists.
- VARIATION 3: Opinion/observation format. Build an argument line by line. No lists, no steps. Just punchy reasoning that leads to a sharp conclusion.

LAST 2-3 LINES — THE CTA:
Pick a DIFFERENT ending style for each variation. Options:
a. A genuine question that sparks discussion: "What's the dumbest thing you've automated?"
b. A polarizing opinion that forces a reaction: "If you disagree, I'd love to hear why."
c. Ask people to share their experience: "What's your version of this?"
d. A resource offer ONLY if there's something real to give: "Want my [specific thing]? Comment [KEYWORD] and I'll send it over."
e. Just end with a strong final line. No ask at all.
DO NOT use the "Comment KEYWORD" format on more than 1 variation.

═══ FORMATTING RULES ═══
- One thought per line. NEVER more than 15 words on a single line.
- Aggressive line breaks. White space everywhere.
- NO indentation. NO tabs. Every line starts at the left margin.
- NO parentheses () anywhere. LinkedIn truncates them. Use periods instead.
- NO hashtags. NO emojis in the first 3 lines.
- NO markdown. Plain text only.
- Single space after numbers: "1. " not "1.  "
- Plain quotes only — no smart/curly quotes.
- 150-300 words per variation. Tight. No filler.

═══ BANNED WORDS ═══
NEVER use: leverage, synergy, game-changer, delve, landscape, tapestry, unleash, harness, paradigm, robust, thrilled, excited to announce, in today's fast-paced world, buckle up, let that sink in, here's the thing, without further ado, at the end of the day

═══ CONTENT RULES ═══
- Business outcomes ONLY: revenue, leads, time saved, costs cut, conversions.
- NO model names, version numbers, APIs, technical specs.
- NO coding, programming, or developer stuff.
- Every tip must be something they can DO today. Not theory.
- AI = business weapon, not technology to geek out about.
- Be SPECIFIC with numbers: "$3K saved", "47 minutes instead of 3 hours", "2x conversion rate"

═══ WHAT MAKES A POST GET 100+ COMMENTS ═══
- A bold opinion that people either love or hate
- A specific result that makes people ask "how?"
- A framework or prompt people want to screenshot
- A CTA that asks for a comment keyword to get a freebie

Each variation needs a DIFFERENT hook type, DIFFERENT angle, DIFFERENT CTA keyword.

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
  const prompt = `You are Allen's editor. Allen Anant Thomas is a 20-something agency founder who's sharp, witty, and talks like a real person. NOT like a LinkedIn influencer. NOT like ChatGPT.

Here are 3 LinkedIn post drafts that need to sound like Allen actually wrote them:

${variations}

═══ ALLEN'S VOICE CHECKLIST ═══
Read each line out loud. If it sounds like a corporate blog post, rewrite it. Allen sounds like:
- A smart friend explaining something over coffee
- Someone who's done this stuff, not just read about it
- Blunt but not mean. Confident but not arrogant.
- Occasionally funny in a dry, witty way

═══ FIXES TO MAKE ═══
1. Kill corporate speak. "Utilize" → "use". "Implement" → "do". "Optimize" → "fix".
2. Add personal proof. "I tested this last week." "One of my clients tried this." "I've made this mistake."
3. Make hooks SHORTER and PUNCHIER. If the hook is over 12 words, cut it.
4. Every line: max 15 words. If longer, break it.
5. No two consecutive lines should start with the same word.
6. Remove ALL filler: "actually", "basically", "honestly", "literally", "just", "simply", "really" — unless it adds punch.
7. Replace em-dashes with periods or line breaks.
8. The CTA should feel like a casual offer, not a sales pitch. Like: "Want my AI prompt pack? Comment PROMPTS and I'll send it over."
9. Add ONE moment of personality per post — a small joke, a bold opinion, or a relatable frustration.
10. Check the first 3 lines. They must make someone NEED to click "see more." If they don't, rewrite them.

═══ AI DETECTION ═══
If ANY line sounds like it was written by AI, rewrite it. Common tells:
- Starting with "In today's..." or "As a..."
- Lists that all follow the same sentence structure
- Overly balanced, diplomatic statements — Allen takes sides
- Perfect grammar everywhere — real people use fragments

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
1. HOOK POWER: Would YOU stop scrolling? Is it under 12 words? Does it create a curiosity gap or make a bold claim?
2. REHOOK: Does line 3 slam the door? Can you NOT scroll past?
3. COMMENT MAGNET: Will this post make people ARGUE, ASK QUESTIONS, or SHARE? Lukewarm = 0 comments.
4. VALUE DENSITY: Does every single line add value? Is there any filler?
5. ALLEN'S VOICE: Does it sound like a bold, witty agency founder? Or like ChatGPT?
6. SPECIFICITY: Are there real numbers, real steps, real examples? Or vague advice?
7. CTA PULL: Would someone actually comment the keyword to get the freebie?

═══ PICK THE WINNER AND POLISH IT ═══
Take the best variation and make these final tweaks:
- If the hook can be shorter, make it shorter
- If any line is filler, delete it
- If any line sounds like AI, rewrite it in Allen's voice
- Make sure the post is 150-300 words. Tight. No padding.
- The CTA should feel natural. NOT every post needs "Comment KEYWORD." If the post ends with a strong question or opinion, that's fine.
- Add one moment of personality if missing — humor, frustration, or a bold opinion

Respond in this format:
BEST_POST:
[the final polished post]`;

  return await callGemini(prompt);
}

// ─── Step 7: Final quality review ───

async function qualityReview(post: string, topic: string): Promise<string> {
  const prompt = `Final quality review before this LinkedIn post goes live. Fix any issues and return the clean version.

POST:
${post}

═══ FORMATTING CHECKS ═══
1. Every line starts at the left margin? NO indentation, NO tabs, NO leading spaces.
2. Every line has only ONE thought? Max 15 words per line.
3. No markdown? No **bold**, no *italic*, no #headers, no [links]().
4. No parentheses ()? LinkedIn truncates them. Replace with periods.
5. No em-dashes? Replace with periods or line breaks.
6. No double spaces after numbers? "1. " not "1.  "
7. Plain quotes only? No smart/curly quotes.
8. No 3+ consecutive blank lines? Max 2 blank lines between sections.

═══ VOICE CHECKS ═══
9. AI words? REMOVE: delve, landscape, harness, unleash, robust, paradigm, synergy, leverage, tapestry, game-changer, thrilled, excited to announce, let that sink in, here's the thing, buckle up, without further ado, at the end of the day, navigate, elevate, foster, facilitate
10. Does it sound like Allen? Bold, blunt, witty. NOT corporate. NOT ChatGPT.
11. No two consecutive lines start with the same word?
12. No model names, version numbers, APIs, or tech jargon?
13. Is there at least one moment of personality — humor, opinion, or frustration?

═══ STRUCTURE CHECKS ═══
14. HOOK: Is line 1 under 12 words? Would YOU stop scrolling?
15. REHOOK: Does line 3 make it impossible to scroll past?
16. VALUE: Does every line in the middle add value? Cut any filler.
17. CTA: Does the post end strong? It can be a question, a bold opinion, a resource offer, or just a mic-drop line. NOT every post needs "Comment KEYWORD." If the ending feels forced or formulaic, rewrite it.
18. LENGTH: 150-300 words? If over 300, cut the fat.

═══ FINAL TEST ═══
Read the post out loud. If any sentence sounds like a corporate blog, a motivational poster, or a ChatGPT response — rewrite it in Allen's voice.

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

// ─── Step 8: Extract image data for freebie (Notion-style) card ───

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

  // Step 1: Pick the best topic from research
  console.log(`  [1/7] Picking topic (${postType} mode)...`);
  const topic = postType === "news"
    ? await pickNewsTopic(research, recentTopics)
    : await pickTopic(research, recentTopics);
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

  // Extract image data (news gets news-style card, freebie gets Notion-style card)
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
      ["-p", "--model", "sonnet", "--output-format", "text"],
      {
        input: prompt,
        encoding: "utf-8",
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
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
