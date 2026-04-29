import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { renderLeadMagnetPdf, LeadMagnetData } from "./lead-magnet-renderer";

// ── Config ────────────────────────────────────────────────────────

// Where lead magnet PDFs live on the Linux box. Created on first write.
const DEFAULT_OUT_DIR = process.env.LEAD_MAGNET_DIR || "/home/allen-thomas/linkedin-lead-magnets";

// ── Generation ─────────────────────────────────────────────────────

interface GenerateLeadMagnetArgs {
  postContent: string;
  topic: string;
  ctaKeyword: string;
  leadMagnetTitle: string;
  outDir?: string;
}

export interface GeneratedLeadMagnet {
  pdfPath: string;
  data: LeadMagnetData;
  bytes: number;
}

/**
 * Builds a lead magnet PDF for a published LinkedIn post.
 *
 * Steps:
 * 1. Ask Claude to expand the post into a structured 4-6 step playbook with concrete actions, prompts, and resources.
 * 2. Render PDF via React PDF + TGE theme.
 * 3. Write to disk at <outDir>/<KEYWORD>.pdf.
 */
export async function generateLeadMagnet(args: GenerateLeadMagnetArgs): Promise<GeneratedLeadMagnet> {
  const { postContent, topic, ctaKeyword, leadMagnetTitle } = args;
  const outDir = args.outDir || DEFAULT_OUT_DIR;

  if (!ctaKeyword || ctaKeyword === "NONE") {
    throw new Error("generateLeadMagnet called with no CTA keyword. Post likely had no freebie offer.");
  }

  console.log(`[LeadMagnet] Generating for keyword "${ctaKeyword}" / title "${leadMagnetTitle}"`);

  const data = await designLeadMagnet({
    postContent,
    topic,
    ctaKeyword,
    leadMagnetTitle,
  });

  const buffer = await renderLeadMagnetPdf(data);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const safeKw = ctaKeyword.replace(/[^A-Z0-9_]/g, "");
  const pdfPath = path.join(outDir, `${safeKw}.pdf`);
  fs.writeFileSync(pdfPath, buffer);
  console.log(`[LeadMagnet] Wrote ${buffer.length} bytes to ${pdfPath}`);

  return { pdfPath, data, bytes: buffer.length };
}

// ── Designer: ask Claude to expand the post into structured playbook content ──

async function designLeadMagnet(args: {
  postContent: string;
  topic: string;
  ctaKeyword: string;
  leadMagnetTitle: string;
}): Promise<LeadMagnetData> {
  const { postContent, topic, ctaKeyword, leadMagnetTitle } = args;

  const prompt = `You are designing a free PDF playbook for Allen Anant Thomas, founder of The Growth Engine. Audience: founders and marketers who saw the LinkedIn post and want the deeper "how to actually do this" version.

═══ THE LINKEDIN POST THAT TRIGGERED THIS DOWNLOAD ═══
Topic: ${topic}
CTA keyword: ${ctaKeyword}
Asset title (working): ${leadMagnetTitle || "to be confirmed"}

POST:
${postContent}

═══ HARD GUARDRAILS ═══
- NEVER mention specific clients (Hoogah, Dr SW, Restart Medical, SideXSide, Frenchify, KP Singh, Kaylyn, etc.) or anonymized references that could only be one of his clients.
- NEVER mention internal bots or automations Allen has built privately (Meta Ads Reporter, Upwork Lead Bot, the LinkedIn bot itself, dashboards, content pipelines, etc.).
- Keep this playbook 100% public-knowledge. Generic AI marketing tools, public news, public tactics. Allen is the messenger of public knowledge, not a tour guide for his private stack.
- Operational anecdotes are FINE if needed for examples. Big revenue/MRR/ARR claims and growth multiples ≥3x are NOT. No "we 10x'd ROAS", no "$500K MRR", no specific TGE financials. Allowed: budgets under $1K, hours saved, CPA/CTR deltas under 50%, plausible time-windows.

═══ PLAYBOOK QUALITY BAR ═══
The reader should be able to read this once and TAKE ACTION today.
- Specific tools (real product names: Claude, ChatGPT, Gemini, Meta Ads Manager, HubSpot, Apollo, etc.)
- Specific prompts they can copy-paste
- Specific numbers, thresholds, or examples
- Concrete steps in order. Not theory. Not high-level strategy. The actual moves.
- Brief. 4-6 steps. Each step body 60-120 words. No padding.

═══ OUTPUT FORMAT ═══
Return ONLY valid JSON in this exact shape (no prose around it):

{
  "title": "Short headline title for the playbook (4-7 words). Use sentence case.",
  "subtitle": "One supporting line, under 16 words, that sells why someone should read this.",
  "intro": "A 70-110 word setup that frames the problem and what they will walk away with. Direct, specific. No fluff intros like 'In today's fast-paced world.' Just say what the situation is and why this playbook fixes it.",
  "steps": [
    {
      "number": 1,
      "title": "Action verb + concrete object. Sentence case. Under 9 words.",
      "body": "60-120 word explanation of what to do. Be specific. Name the tool. Name the threshold. Give an example.",
      "bullets": ["Optional. 2-5 short bullets if useful. Each under 14 words."],
      "prompt": "Optional. Include a copy-paste prompt or template if the step involves talking to an AI. 30-80 words."
    }
  ],
  "resources": [
    { "label": "Tool or resource name", "detail": "One line on what it is and where to find it." }
  ],
  "closingTip": "Optional one-paragraph (40-70 words) closing tip that anticipates the most common screw-up."
}

Rules for the JSON:
- 4-6 steps total. Not more, not less.
- Each step.body 60-120 words. Each step.title under 9 words.
- 3-5 resources, real and reachable.
- Sentence case proper throughout. No lowercase casual. No "Well, lol, to be very honest."
- No em-dashes. Replace with periods or "and".
- No banned LinkedIn-bro words: leverage, synergy, paradigm, robust, unleash, harness, elevate, foster, navigate, revolutionize, skyrocket, supercharge, game-changer, delve, landscape, tapestry, "let that sink in", "here's the thing".
- Title and subtitle MUST align with the lead magnet title proposed: "${leadMagnetTitle || "<bot can pick>"}". If the proposed title is weak, you can refine it but stay close.

Output: just the JSON, no commentary.`;

  const raw = callClaudeCli(prompt);
  const data = parseLeadMagnetJson(raw);

  // Default brand fields
  data.ctaKeyword = ctaKeyword;
  data.authorName = data.authorName || "Allen Anant Thomas";
  data.brandName = data.brandName || "The Growth Engine";

  return data;
}

function callClaudeCli(prompt: string): string {
  try {
    const out = execFileSync(
      "claude",
      ["-p", "--model", "opus", "--output-format", "text"],
      {
        input: prompt,
        encoding: "utf-8",
        timeout: 300_000,
        maxBuffer: 4 * 1024 * 1024,
      }
    );
    const text = out.trim();
    if (!text) throw new Error("Empty Claude CLI response");
    return text;
  } catch (err: any) {
    throw new Error(`Claude CLI failed for lead magnet design: ${err.message}`);
  }
}

function parseLeadMagnetJson(raw: string): LeadMagnetData {
  // Strip code fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Find first { and last }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`Could not find JSON object in Claude output:\n${raw.slice(0, 400)}`);
  }
  const jsonText = cleaned.slice(start, end + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e: any) {
    throw new Error(`Lead magnet JSON parse failed: ${e.message}\nRaw:\n${jsonText.slice(0, 800)}`);
  }

  if (!parsed.title || !parsed.subtitle || !parsed.intro || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error("Lead magnet JSON missing required fields (title/subtitle/intro/steps).");
  }

  // Coerce
  const steps = parsed.steps.map((s: any, i: number) => ({
    number: s.number ?? i + 1,
    title: String(s.title || `Step ${i + 1}`),
    body: String(s.body || ""),
    bullets: Array.isArray(s.bullets) && s.bullets.length > 0 ? s.bullets.map(String) : undefined,
    prompt: s.prompt ? String(s.prompt) : undefined,
  }));

  const resources = Array.isArray(parsed.resources)
    ? parsed.resources.map((r: any) => ({
        label: String(r.label || "Resource"),
        detail: String(r.detail || ""),
      }))
    : [];

  return {
    title: String(parsed.title),
    subtitle: String(parsed.subtitle),
    ctaKeyword: "PLACEHOLDER",
    intro: String(parsed.intro),
    steps,
    resources,
    closingTip: parsed.closingTip ? String(parsed.closingTip) : undefined,
  };
}
