// Test render of the lead magnet PDF using mock data, no Claude call.
// Run with: npx tsx scripts/test-lead-magnet-render.ts

import fs from "fs";
import path from "path";
import { renderLeadMagnetPdf, LeadMagnetData } from "../src/content/lead-magnet-renderer";

const mock: LeadMagnetData = {
  title: "The Claude Opus 4.7 Marketing Playbook",
  subtitle: "How to use the new 1M context window to research, plan and ship a campaign in one prompt.",
  ctaKeyword: "OPUS",
  intro:
    "Anthropic just shipped Claude Opus 4.7 with a 1 million token context window. For marketers this changes one thing: you can hand Claude an entire campaign brief, every past report, every brand guideline, and every competitor post in one prompt and get a coherent answer back. No more chunking. No more 'remember what I said three messages ago.' This playbook walks through exactly how to use it for a single end-to-end marketing workflow today.",
  steps: [
    {
      number: 1,
      title: "Stage your campaign context in one folder",
      body:
        "Create a single folder containing every document Claude needs to know about: the campaign brief, your buyer personas, the last 12 months of ad reports, competitor positioning, brand guidelines, and the offer page copy. Don't filter or summarize. With 1M tokens you can paste it all. The point is to feed Claude the same raw context a senior strategist would have on day one.",
      bullets: [
        "Brief, ICP, brand voice, offer page",
        "Last 12 months of ad reports as CSV",
        "3-5 competitor landing pages saved as text",
        "Past 30 of your own social posts",
      ],
    },
    {
      number: 2,
      title: "Open Claude with the context loaded",
      body:
        "In claude.ai or via the API, drop the entire folder content into the message. With Opus 4.7's 1M window, a typical mid-size campaign fits in roughly 300k-500k tokens, so you have plenty of headroom. Use the prompt below to anchor Claude's role before it writes anything.",
      prompt:
        "You are a senior performance marketer reviewing the campaign context I just gave you. Spend the first response reading everything end to end. Then summarize: 1. The single most important insight from the data. 2. The biggest gap or contradiction across the documents. 3. The one constraint that should drive the campaign strategy. Do not propose a plan yet.",
    },
    {
      number: 3,
      title: "Ask for the strategy after the read pass",
      body:
        "Only after Claude has demonstrated it actually read the materials should you ask for the plan. This second prompt forces Claude to ground every recommendation in something specific from the context. Without it you get the same generic 'run Meta ads, send a newsletter' output you'd get without the 1M window.",
      prompt:
        "Now propose the campaign plan. For every recommendation, cite which document or data point in the context you are basing it on. If you cannot cite a source for a recommendation, label it as a guess. The goal is a plan I can defend in front of a CFO.",
    },
    {
      number: 4,
      title: "Use the same context for execution",
      body:
        "The same loaded session can now write the ads, the email sequence, and the landing page copy in your brand voice without you re-explaining anything. Keep the conversation alive. Each new ask inherits the entire campaign context for free, which is the real unlock here.",
      bullets: [
        "Ad variations: 'Write 8 Meta ad variants for the Tier 2 audience'",
        "Email sequence: '5-email nurture for the lead magnet'",
        "Landing page: 'Rewrite the hero with the v3 ICP framing'",
      ],
    },
    {
      number: 5,
      title: "Capture what worked and feed it back",
      body:
        "After 14 days of running, dump the new ad reports back into Claude in the same conversation. Ask for the diff between the strategy you launched and what the data is saying. This is the loop most teams skip. With a 1M window the entire history of decisions is still in context, so the diff is real, not invented.",
      prompt:
        "Compare the campaign performance from days 1-14 against the original strategy you proposed. Where is reality matching the plan, where is it diverging, and what is the smallest change that would close the gap? Reference the original plan directly.",
    },
  ],
  resources: [
    { label: "Claude Opus 4.7", detail: "claude.ai or Anthropic API. The 1M context tier is currently in the Pro plan and API." },
    { label: "Anthropic Cookbook", detail: "github.com/anthropics/anthropic-cookbook. Long-context examples, batching patterns." },
    { label: "Token counter", detail: "anthropic.com/tokenizer. Paste your context to see how many tokens you're using before sending." },
    { label: "Claude API docs", detail: "docs.anthropic.com. Look for the 'long context' guide for cost and performance notes." },
  ],
  closingTip:
    "The most common screw-up: dumping 600k tokens of context and then asking Claude a 5-word question. The bigger the context, the more deliberate the prompt has to be. Always state the role, the goal, and the format you want the answer in. The context does the rest.",
  authorName: "Allen Anant Thomas",
  brandName: "The Growth Engine",
};

async function main() {
  const buffer = await renderLeadMagnetPdf(mock);
  const outDir = path.resolve(__dirname, "..", "out");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "lead-magnet-sample.pdf");
  fs.writeFileSync(outPath, buffer);
  console.log(`Wrote ${buffer.length} bytes to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
