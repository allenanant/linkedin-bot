import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { renderCarouselPdf, CarouselData } from "./carousel-renderer";
import { config } from "../config";

export { CarouselData } from "./carousel-renderer";

export async function extractCarouselData(
  post: string,
  topic: string
): Promise<CarouselData> {
  const prompt = `You are extracting content for a LinkedIn PDF carousel from this post.

POST:
${post}

TOPIC: ${topic}

The carousel needs 5-6 slides of content. Each slide has ONE key point.
The cover slide is in Nick Saraev's style: big bold hook at the top, with a key phrase highlighted in gold.

RULES:
- HOOK: A bold, curiosity-driven headline for the cover slide. 6-12 words max. Should make someone stop scrolling.
- HOOK_ACCENT: The specific 3-5 word phrase WITHIN the hook that should be highlighted in gold italic. This should be the most emotionally resonant or specific part.
- SUBTITLE: 1 short sentence expanding on the hook. Under 12 words.
- Each SLIDE_TITLE: 3-6 words. Bold, clear, scannable.
- Each SLIDE_BODY: 1-2 sentences max. The practical detail or insight. Keep it tight.
- CTA: A friendly call to action for the last slide. Under 10 words.

Respond in this EXACT format:
HOOK: [6-12 words]
HOOK_ACCENT: [3-5 words from the hook]
SUBTITLE: [under 12 words]
SLIDE1_TITLE: [3-6 words]
SLIDE1_BODY: [1-2 sentences]
SLIDE2_TITLE: [3-6 words]
SLIDE2_BODY: [1-2 sentences]
SLIDE3_TITLE: [3-6 words]
SLIDE3_BODY: [1-2 sentences]
SLIDE4_TITLE: [3-6 words]
SLIDE4_BODY: [1-2 sentences]
SLIDE5_TITLE: [3-6 words]
SLIDE5_BODY: [1-2 sentences]
CTA: [under 10 words]`;

  const result = execFileSync(
    "claude",
    ["-p", "--model", "opus", "--output-format", "text"],
    {
      input: prompt,
      encoding: "utf-8",
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    }
  ).trim();

  const hookMatch = result.match(/HOOK:\s*(.+)/);
  const hookAccentMatch = result.match(/HOOK_ACCENT:\s*(.+)/);
  const subtitleMatch = result.match(/SUBTITLE:\s*(.+)/);
  const ctaMatch = result.match(/CTA:\s*(.+)/);

  const slides: CarouselData["slides"] = [];
  for (let i = 1; i <= 6; i++) {
    const titleMatch = result.match(new RegExp(`SLIDE${i}_TITLE:\\s*(.+)`));
    const bodyMatch = result.match(new RegExp(`SLIDE${i}_BODY:\\s*(.+)`));
    if (titleMatch && bodyMatch) {
      slides.push({
        number: i,
        title: titleMatch[1].trim(),
        body: bodyMatch[1].trim(),
      });
    }
  }

  return {
    hook: hookMatch?.[1]?.trim() || topic.slice(0, 50),
    hookAccent: hookAccentMatch?.[1]?.trim() || undefined,
    subtitle: subtitleMatch?.[1]?.trim() || "A practical breakdown",
    slides: slides.length > 0
      ? slides
      : [
          { number: 1, title: "Key Insight", body: "The main takeaway from this topic." },
          { number: 2, title: "How It Works", body: "The practical details you need to know." },
          { number: 3, title: "What To Do", body: "Steps you can take today." },
        ],
    ctaText: ctaMatch?.[1]?.trim() || "Found this useful? Follow for more AI marketing tips.",
  };
}

export async function generateCarousel(
  post: string,
  topic: string
): Promise<Buffer> {
  console.log("  [Carousel] Extracting slide content...");
  const carouselData = await extractCarouselData(post, topic);

  console.log(`  [Carousel] Got ${carouselData.slides.length} slides`);
  const pdfBuffer = await renderCarouselPdf(carouselData);

  return pdfBuffer;
}

export function shouldGenerateCarousel(): boolean {
  // 40% chance of carousel post vs regular image
  return Math.random() < 0.4;
}
