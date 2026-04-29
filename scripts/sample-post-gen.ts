// Generate one full LinkedIn post + lead-magnet PDF for a fixed topic.
// Bypasses the research pull (uses stub data + topic override).
// Run on the Linux box where Claude CLI is authenticated.
//
// Usage:
//   npx tsx scripts/sample-post-gen.ts "<topic>" "<output_label>"
//
// Output:
//   out/sample-<label>.json  -- {topic, content, voiceMode, ctaKeyword, leadMagnetTitle}
//   out/sample-<label>.pdf   -- the lead magnet PDF (if CTA keyword present)

import fs from "fs";
import path from "path";
import { generateLinkedInPost, type ResearchData } from "../src/content/generator";
import { generateLeadMagnet } from "../src/content/lead-magnet-generator";

const STUB_RESEARCH: ResearchData = {
  trendingTopics: [],
  dailyTrends: [],
  newsArticles: [],
  competitorMentions: [],
};

async function main() {
  const topic = process.argv[2];
  const label = process.argv[3] || "sample";
  if (!topic) {
    console.error("Usage: npx tsx scripts/sample-post-gen.ts \"<topic>\" \"<label>\"");
    process.exit(1);
  }

  console.log(`Generating post for topic: ${topic}`);
  console.log(`Label: ${label}`);

  // No initDb — pipeline skips DB calls when topicOverride is supplied.

  const generated = await generateLinkedInPost(
    STUB_RESEARCH,
    /* shouldIncludeImage */ false,
    /* postType */ "freebie",
    /* postFormat */ "video",
    /* topicOverride */ topic
  );

  const outDir = path.resolve(__dirname, "..", "out");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const summary = {
    topic: generated.topic,
    voiceMode: generated.voiceMode,
    ctaKeyword: generated.ctaKeyword,
    leadMagnetTitle: generated.leadMagnetTitle,
    content: generated.content,
  };
  const jsonPath = path.join(outDir, `sample-${label}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  console.log(`Wrote summary to ${jsonPath}`);

  console.log("\n========= POST CONTENT =========\n");
  console.log(generated.content);
  console.log("\n================================\n");
  console.log(`Voice mode: ${generated.voiceMode}`);
  console.log(`CTA keyword: ${generated.ctaKeyword || "(none)"}`);
  console.log(`Lead magnet title: ${generated.leadMagnetTitle || "(none)"}`);

  if (generated.ctaKeyword && generated.ctaKeyword !== "NONE") {
    console.log("\nGenerating lead magnet PDF...");
    const result = await generateLeadMagnet({
      postContent: generated.content,
      topic: generated.topic,
      ctaKeyword: generated.ctaKeyword,
      leadMagnetTitle: generated.leadMagnetTitle || "",
      outDir,
    });
    // Re-name to include label
    const renamed = path.join(outDir, `sample-${label}-${generated.ctaKeyword}.pdf`);
    fs.copyFileSync(result.pdfPath, renamed);
    console.log(`Lead magnet PDF: ${renamed} (${result.bytes} bytes)`);
  } else {
    console.log("Skipping lead magnet (no CTA keyword in post).");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
