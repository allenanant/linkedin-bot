import { execFileSync } from "child_process";

/**
 * Paraphrase generators for the comment watcher.
 *
 * Three message types, all run through Claude CLI so each output is unique:
 *   - connect_request: a reply asking the keyword commenter to connect first
 *   - casual_reply:    a casual reply to a non-keyword commenter
 *   - dm_with_pdf:     the DM body that goes with the lead magnet attachment
 *
 * Voice rules (locked 2026-04-29):
 *   - Allen's voice: humble, tactical, sentence case, conversational. No emojis.
 *   - No em-dashes (Allen filters these out elsewhere too).
 *   - No corporate filler ("Excited to share...", "Hope this helps!").
 *   - First-person, like a real person typing on their phone.
 */

const VOICE_GUARDRAILS = `
VOICE RULES (apply to every output):
- Sentence case. No title case unless it's a proper noun.
- No em-dashes. Use periods or commas.
- No filler intros: "Excited", "Hope", "Just wanted", "Great point". Skip them entirely.
- No emojis.
- Don't repeat the freebie title every sentence — once is enough.
- Sound like a person on their phone, not a marketing email.
- Avoid hype words: leverage, unlock, supercharge, elevate, robust, paradigm, harness, foster, revolutionize, skyrocket, game-changer.
- Allowed contractions: I'd, I'll, you're, that's. Use them.
`.trim();

interface ParaphraseInput {
  commenterName: string;
  leadMagnetTitle: string;
  ctaKeyword: string;
  postExcerpt: string;
  commentText?: string;
}

function callClaude(prompt: string, model = "sonnet"): string {
  const out = execFileSync(
    "claude",
    ["-p", "--model", model, "--output-format", "text"],
    {
      input: prompt,
      encoding: "utf-8",
      timeout: 60_000,
      maxBuffer: 1 * 1024 * 1024,
    }
  );
  const text = (out || "").trim();
  if (!text) throw new Error("Claude CLI returned empty response");
  return stripQuotes(text);
}

function stripQuotes(s: string): string {
  // Models often wrap output in quotes or add prefacing labels. Clean it.
  let t = s.trim();
  // Remove leading "Here's a paraphrased version:" type prefaces
  t = t.replace(/^(here'?s.*?:\s*)/i, "");
  t = t.replace(/^(reply\s*:?\s*)/i, "");
  // Strip surrounding quotes
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1);
  }
  return t.trim();
}

function firstName(full: string | null | undefined): string {
  if (!full) return "there";
  const t = full.trim().split(/\s+/)[0];
  return t || "there";
}

/**
 * Reply for keyword commenter who is NOT yet connected to Allen.
 * Asks them to send a connect request so the freebie can be DM'd.
 */
export async function paraphraseConnectRequest(input: ParaphraseInput): Promise<string> {
  const name = firstName(input.commenterName);
  const prompt = `You're writing a one-line LinkedIn reply for Allen Anant Thomas.

Context:
- Allen posted on LinkedIn with a "Comment ${input.ctaKeyword}" call-to-action for a freebie titled "${input.leadMagnetTitle}".
- Someone named "${name}" just commented "${input.ctaKeyword}" but they are NOT yet connected to Allen.
- LinkedIn doesn't let Allen DM strangers easily, so he needs them to send him a connection request.

Your task: write a single-line reply (max 28 words) telling them to send a connection request so Allen can DM them the "${input.leadMagnetTitle}".

${VOICE_GUARDRAILS}

EXTRA RULES:
- Open with their first name (just "${name}", no title).
- Make it sound like a small ask, not a demand.
- Don't include hashtags, links, or @mentions.
- Output only the reply text. No quotes, no preamble, no signature.
- Vary phrasing — never reuse stock lines like "send me a connect request and I'll DM it over."

Output the reply only.`;
  return callClaude(prompt, "sonnet");
}

/**
 * Reply for non-keyword commenter (someone who commented something other than the CTA).
 * Just acknowledge what they said in Allen's voice. Don't pitch the freebie.
 */
export async function paraphraseCasualReply(input: ParaphraseInput): Promise<string> {
  const name = firstName(input.commenterName);
  const comment = (input.commentText || "").slice(0, 400);
  const post = input.postExcerpt.slice(0, 400);
  const prompt = `You're writing a one-line LinkedIn reply for Allen Anant Thomas.

Context:
- Allen's recent post (excerpt): """${post}"""
- Someone named "${name}" commented: """${comment}"""
- They did NOT use the freebie keyword, so don't pitch the freebie.

Your task: write a short, warm, in-character acknowledgment (8-22 words). Match the energy of their comment. If they asked a question, give a tight answer or say you'll DM more. If they shared something, react genuinely.

${VOICE_GUARDRAILS}

EXTRA RULES:
- Open with their first name (just "${name}", no title) ONLY if it feels natural — otherwise skip.
- Don't ask them to do anything (no CTAs).
- Don't pitch any freebie.
- Don't include hashtags, links, or @mentions.
- Output only the reply text. No quotes, no preamble, no signature.

Output the reply only.`;
  return callClaude(prompt, "sonnet");
}

/**
 * The DM that goes with the freebie PDF. Sent after we accept their connection
 * request (or immediately if they were already connected).
 */
export async function paraphraseDm(input: ParaphraseInput): Promise<string> {
  const name = firstName(input.commenterName);
  const prompt = `You're writing a short LinkedIn DM for Allen Anant Thomas to send to a new connection.

Context:
- Allen posted on LinkedIn and offered a freebie titled "${input.leadMagnetTitle}" to anyone who commented "${input.ctaKeyword}".
- "${name}" commented and is now connected to Allen.
- The PDF is attached to this DM.

Your task: write a 2-line DM (40-65 words total) that:
1. Says hi by first name and references their interest in "${input.leadMagnetTitle}".
2. Mentions the PDF is attached and one specific reason they'll find it useful.
3. Optionally invites a one-line reply if they have questions.

${VOICE_GUARDRAILS}

EXTRA RULES:
- Open with "${name}" (no title).
- Don't repeat the keyword "${input.ctaKeyword}" in the DM (they already used it).
- Don't include hashtags, links, or @mentions.
- Output the DM body only. No quotes, no preamble, no signature.

Output the DM only.`;
  return callClaude(prompt, "sonnet");
}
