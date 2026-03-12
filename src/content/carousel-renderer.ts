import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";

// ── Types ──────────────────────────────────────────────────────────

export interface CarouselData {
  hook: string; // Full hook text
  hookAccent?: string; // Phrase within hook to render in gold (if not set, last ~4 words are gold)
  subtitle: string;
  slides: CarouselSlide[];
  ctaText?: string;
  authorName?: string;
  brandName?: string;
}

interface CarouselSlide {
  number: number;
  title: string;
  body: string;
}

// ── Font loading ───────────────────────────────────────────────────

const FONTS_DIR = path.resolve(__dirname, "fonts");

function loadFont(
  filename: string,
  name: string,
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
) {
  return {
    name,
    data: fs.readFileSync(path.join(FONTS_DIR, filename)),
    weight,
    style: "normal" as const,
  };
}

const fonts = [
  loadFont("Inter-Regular.ttf", "Inter", 400),
  loadFont("Inter-SemiBold.ttf", "Inter", 600),
  loadFont("Inter-Bold.ttf", "Inter", 700),
  loadFont("Poppins-Bold.ttf", "Poppins", 700),
];

// ── Dimensions (portrait 4:5 for LinkedIn carousel) ────────────────

const W = 1080;
const H = 1350;

// ── Nick Saraev-inspired palette ───────────────────────────────────

const C = {
  bg: "#0c0c0c",
  white: "#f5f0e8",
  gold: "#c8a97e",
  gray: "#6b6b6b",
  subtle: "#3a3a3a",
  arrow: "#8a8a8a",
};

// ── Load headshot as base64 ────────────────────────────────────────

function loadHeadshotBase64(): string | null {
  const headshotPath = path.resolve(__dirname, "../../assets/headshot.png");
  if (!fs.existsSync(headshotPath)) return null;
  const data = fs.readFileSync(headshotPath);
  return `data:image/png;base64,${data.toString("base64")}`;
}

// ── Split hook into white + gold parts ─────────────────────────────

function splitHook(hook: string, accent?: string): { white: string; gold: string } {
  if (accent) {
    const idx = hook.toLowerCase().indexOf(accent.toLowerCase());
    if (idx !== -1) {
      return {
        white: hook.slice(0, idx).trim(),
        gold: hook.slice(idx, idx + accent.length).trim(),
      };
    }
  }
  // Fallback: last ~4 words become gold
  const words = hook.split(/\s+/);
  const splitAt = Math.max(1, words.length - 4);
  return {
    white: words.slice(0, splitAt).join(" "),
    gold: words.slice(splitAt).join(" "),
  };
}

// ══════════════════════════════════════════════════════════════════
// COVER SLIDE - Big hook + large face photo from bottom
// ══════════════════════════════════════════════════════════════════

function buildCoverSlide(data: CarouselData): any {
  const headshot = loadHeadshotBase64();
  const { white: hookWhite, gold: hookGold } = splitHook(data.hook, data.hookAccent);

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: W,
        height: H,
        backgroundColor: C.bg,
        fontFamily: "Poppins",
        position: "relative",
        overflow: "hidden",
      },
      children: [
        // Hook text - top left
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              padding: "72px 64px 0 64px",
              zIndex: 2,
            },
            children: [
              // White part of hook
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: 72,
                    fontWeight: 700,
                    color: C.white,
                    lineHeight: 1.1,
                  },
                  children: hookWhite,
                },
              },
              // Gold part of hook
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: 72,
                    fontWeight: 700,
                    color: C.gold,
                    lineHeight: 1.1,
                    fontStyle: "italic",
                  },
                  children: hookGold,
                },
              },
            ],
          },
        },
        // Headshot - large, bottom center
        ...(headshot
          ? [
              {
                type: "img",
                props: {
                  src: headshot,
                  width: 700,
                  height: 700,
                  style: {
                    position: "absolute",
                    bottom: 0,
                    left: 190,
                    zIndex: 1,
                    objectFit: "cover",
                  },
                },
              },
              // Gradient fade over top of headshot
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    position: "absolute",
                    bottom: 350,
                    left: 0,
                    width: W,
                    height: 400,
                    background: `linear-gradient(to bottom, ${C.bg} 0%, ${C.bg}00 100%)`,
                    zIndex: 1,
                  },
                },
              },
            ]
          : []),
        // Arrow - bottom right
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute",
              bottom: 48,
              right: 56,
              fontSize: 36,
              color: C.arrow,
              zIndex: 3,
            },
            children: "\u2192",
          },
        },
      ],
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// CONTENT SLIDE - Clean, bold, minimal
// ══════════════════════════════════════════════════════════════════

function buildContentSlide(slide: CarouselSlide, totalSlides: number): any {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: W,
        height: H,
        backgroundColor: C.bg,
        fontFamily: "Inter",
        padding: "100px 72px",
        justifyContent: "center",
        position: "relative",
      },
      children: [
        // Slide number - large gold
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 140,
              fontWeight: 700,
              fontFamily: "Poppins",
              color: C.gold,
              lineHeight: 1,
              marginBottom: 16,
              opacity: 0.9,
            },
            children: `${slide.number < 10 ? "0" : ""}${slide.number}`,
          },
        },
        // Title
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 48,
              fontWeight: 700,
              fontFamily: "Poppins",
              color: C.white,
              lineHeight: 1.2,
              marginBottom: 32,
            },
            children: slide.title,
          },
        },
        // Body
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 28,
              color: C.arrow,
              fontWeight: 400,
              lineHeight: 1.6,
              maxWidth: 880,
            },
            children: slide.body,
          },
        },
        // Arrow - bottom right
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute",
              bottom: 48,
              right: 56,
              fontSize: 36,
              color: C.arrow,
            },
            children: "\u2192",
          },
        },
      ],
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// CTA SLIDE - Follow + face
// ══════════════════════════════════════════════════════════════════

function buildCtaSlide(data: CarouselData): any {
  const headshot = loadHeadshotBase64();

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: W,
        height: H,
        backgroundColor: C.bg,
        fontFamily: "Inter",
        padding: "100px 72px",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
      },
      children: [
        // Headshot circle
        ...(headshot
          ? [
              {
                type: "img",
                props: {
                  src: headshot,
                  width: 160,
                  height: 160,
                  style: {
                    borderRadius: 80,
                    marginBottom: 40,
                  },
                },
              },
            ]
          : []),
        // Author name
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 36,
              fontWeight: 700,
              fontFamily: "Poppins",
              color: C.white,
              marginBottom: 12,
            },
            children: data.authorName || "Allen Anant Thomas",
          },
        },
        // Brand
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 22,
              color: C.gray,
              marginBottom: 56,
            },
            children: data.brandName || "The Growth Engine",
          },
        },
        // CTA text
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 44,
              fontWeight: 700,
              fontFamily: "Poppins",
              color: C.gold,
              textAlign: "center",
              lineHeight: 1.3,
              maxWidth: 800,
              marginBottom: 24,
            },
            children:
              data.ctaText || "Follow for more",
          },
        },
        // Sub-CTA
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 24,
              color: C.arrow,
              textAlign: "center",
            },
            children: "Like + Save + Repost if this helped",
          },
        },
      ],
    },
  };
}

// ── Render a single slide to PNG buffer ────────────────────────────

async function renderSlide(element: any): Promise<Buffer> {
  const svg = await satori(element, { width: W, height: H, fonts });
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: W },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}

// ── Main: Render all slides and combine into PDF ──────────────────

export async function renderCarouselPdf(
  data: CarouselData
): Promise<Buffer> {
  const totalSlides = data.slides.length + 2;

  const slideElements: any[] = [
    buildCoverSlide(data),
    ...data.slides.map((s) => buildContentSlide(s, totalSlides)),
    buildCtaSlide(data),
  ];

  console.log(`  [Carousel] Rendering ${slideElements.length} slides...`);
  const pngBuffers: Buffer[] = [];
  for (let i = 0; i < slideElements.length; i++) {
    console.log(`  [Carousel] Slide ${i + 1}/${slideElements.length}...`);
    pngBuffers.push(await renderSlide(slideElements[i]));
  }

  console.log("  [Carousel] Assembling PDF...");
  const pdfDoc = await PDFDocument.create();

  for (const pngBuf of pngBuffers) {
    const pngImage = await pdfDoc.embedPng(pngBuf);
    const page = pdfDoc.addPage([W, H]);
    page.drawImage(pngImage, { x: 0, y: 0, width: W, height: H });
  }

  const pdfBytes = await pdfDoc.save();
  console.log(`  [Carousel] PDF ready: ${pdfBytes.length} bytes, ${pngBuffers.length} pages`);

  return Buffer.from(pdfBytes);
}
