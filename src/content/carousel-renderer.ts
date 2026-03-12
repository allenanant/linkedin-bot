import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";

// ── Types ──────────────────────────────────────────────────────────

export interface CarouselData {
  hook: string; // Bold headline for slide 1
  subtitle: string; // Subtitle under hook
  slides: CarouselSlide[]; // 4-6 content slides
  ctaText?: string; // CTA on last slide
  authorName?: string;
  brandName?: string;
}

interface CarouselSlide {
  number: number;
  title: string; // Short bold title (3-6 words)
  body: string; // 1-2 sentence explanation
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

// ── Brand colors ───────────────────────────────────────────────────

const C = {
  bg: "#0a0a12",
  bgLight: "#111120",
  white: "#ffffff",
  offWhite: "#e8e8f0",
  gray: "#888899",
  accent: "#6c63ff", // Purple accent
  accentLight: "#8b83ff",
  accentGlow: "rgba(108, 99, 255, 0.15)",
  border: "#1e1e30",
  subtle: "#444455",
};

// ── Load headshot as base64 ────────────────────────────────────────

function loadHeadshotBase64(): string | null {
  const headshotPath = path.resolve(__dirname, "../../assets/headshot.png");
  if (!fs.existsSync(headshotPath)) return null;
  const data = fs.readFileSync(headshotPath);
  return `data:image/png;base64,${data.toString("base64")}`;
}

// ══════════════════════════════════════════════════════════════════
// SLIDE 1: Cover slide - Hook + Author photo
// ══════════════════════════════════════════════════════════════════

function buildCoverSlide(data: CarouselData): any {
  const headshot = loadHeadshotBase64();

  const authorSection = headshot
    ? {
        type: "div",
        props: {
          style: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 20,
            marginBottom: 48,
          },
          children: [
            {
              type: "img",
              props: {
                src: headshot,
                width: 80,
                height: 80,
                style: {
                  borderRadius: 40,
                  border: `3px solid ${C.accent}`,
                },
              },
            },
            {
              type: "div",
              props: {
                style: { display: "flex", flexDirection: "column", gap: 4 },
                children: [
                  {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        fontSize: 22,
                        fontWeight: 600,
                        color: C.white,
                      },
                      children: data.authorName || "Allen Anant Thomas",
                    },
                  },
                  {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        fontSize: 16,
                        color: C.gray,
                      },
                      children:
                        data.brandName || "The Growth Engine",
                    },
                  },
                ],
              },
            },
          ],
        },
      }
    : {
        type: "div",
        props: {
          style: {
            display: "flex",
            fontSize: 18,
            fontWeight: 600,
            color: C.accent,
            letterSpacing: 3,
            marginBottom: 48,
          },
          children: (
            data.brandName || "THE GROWTH ENGINE"
          ).toUpperCase(),
        },
      };

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
        padding: "80px 72px",
        justifyContent: "center",
      },
      children: [
        // Author section
        authorSection,
        // Accent line
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              width: 60,
              height: 4,
              backgroundColor: C.accent,
              borderRadius: 2,
              marginBottom: 36,
            },
          },
        },
        // Hook headline
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 56,
              fontWeight: 700,
              fontFamily: "Poppins",
              color: C.white,
              lineHeight: 1.15,
              marginBottom: 24,
            },
            children: data.hook,
          },
        },
        // Subtitle
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 24,
              color: C.offWhite,
              fontWeight: 400,
              lineHeight: 1.5,
            },
            children: data.subtitle,
          },
        },
        // Swipe hint at bottom
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute",
              bottom: 60,
              right: 72,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: 16,
                    color: C.subtle,
                    fontWeight: 400,
                  },
                  children: "Swipe",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: 20,
                    color: C.accent,
                  },
                  children: "->",
                },
              },
            ],
          },
        },
      ],
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// CONTENT SLIDE: Number + Title + Body
// ══════════════════════════════════════════════════════════════════

function buildContentSlide(
  slide: CarouselSlide,
  totalSlides: number
): any {
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
        padding: "80px 72px",
        justifyContent: "center",
      },
      children: [
        // Large number
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 120,
              fontWeight: 700,
              fontFamily: "Poppins",
              color: C.accent,
              lineHeight: 1,
              marginBottom: 24,
            },
            children: `0${slide.number}`,
          },
        },
        // Accent line
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              width: 60,
              height: 4,
              backgroundColor: C.accent,
              borderRadius: 2,
              marginBottom: 36,
            },
          },
        },
        // Title
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 44,
              fontWeight: 700,
              fontFamily: "Poppins",
              color: C.white,
              lineHeight: 1.2,
              marginBottom: 28,
            },
            children: slide.title,
          },
        },
        // Body text
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 26,
              color: C.offWhite,
              fontWeight: 400,
              lineHeight: 1.6,
              maxWidth: 880,
            },
            children: slide.body,
          },
        },
        // Page indicator at bottom
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute",
              bottom: 60,
              left: 72,
              right: 72,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: 14,
                    color: C.subtle,
                    letterSpacing: 1,
                  },
                  children: "thegrowthengine.net",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: 16,
                    color: C.subtle,
                  },
                  children: `${slide.number + 1} / ${totalSlides}`,
                },
              },
            ],
          },
        },
      ],
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// CTA SLIDE: Follow + Branding
// ══════════════════════════════════════════════════════════════════

function buildCtaSlide(data: CarouselData, totalSlides: number): any {
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
        padding: "80px 72px",
        justifyContent: "center",
        alignItems: "center",
      },
      children: [
        // Headshot (if available)
        ...(headshot
          ? [
              {
                type: "img",
                props: {
                  src: headshot,
                  width: 120,
                  height: 120,
                  style: {
                    borderRadius: 60,
                    border: `4px solid ${C.accent}`,
                    marginBottom: 32,
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
              fontSize: 32,
              fontWeight: 700,
              color: C.white,
              marginBottom: 8,
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
              fontSize: 20,
              color: C.gray,
              marginBottom: 48,
            },
            children: data.brandName || "The Growth Engine",
          },
        },
        // Accent line
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              width: 60,
              height: 4,
              backgroundColor: C.accent,
              borderRadius: 2,
              marginBottom: 48,
            },
          },
        },
        // CTA text
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 42,
              fontWeight: 700,
              fontFamily: "Poppins",
              color: C.white,
              textAlign: "center",
              lineHeight: 1.3,
              maxWidth: 800,
              marginBottom: 24,
            },
            children:
              data.ctaText || "Found this useful? Follow for more AI marketing tips.",
          },
        },
        // Sub-CTA
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 22,
              color: C.offWhite,
              textAlign: "center",
            },
            children: "Like + Save + Share if it helped.",
          },
        },
        // Footer
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute",
              bottom: 60,
              fontSize: 14,
              color: C.subtle,
              letterSpacing: 1,
            },
            children: "thegrowthengine.net",
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
  const totalSlides = data.slides.length + 2; // cover + content + CTA

  // Build all slide elements
  const slideElements: any[] = [
    buildCoverSlide(data),
    ...data.slides.map((s) => buildContentSlide(s, totalSlides)),
    buildCtaSlide(data, totalSlides),
  ];

  // Render each slide to PNG
  console.log(`  [Carousel] Rendering ${slideElements.length} slides...`);
  const pngBuffers: Buffer[] = [];
  for (let i = 0; i < slideElements.length; i++) {
    console.log(
      `  [Carousel] Slide ${i + 1}/${slideElements.length}...`
    );
    pngBuffers.push(await renderSlide(slideElements[i]));
  }

  // Combine PNGs into a multi-page PDF
  console.log("  [Carousel] Assembling PDF...");
  const pdfDoc = await PDFDocument.create();

  for (const pngBuf of pngBuffers) {
    const pngImage = await pdfDoc.embedPng(pngBuf);
    const page = pdfDoc.addPage([W, H]);
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: W,
      height: H,
    });
  }

  const pdfBytes = await pdfDoc.save();
  console.log(
    `  [Carousel] PDF ready: ${pdfBytes.length} bytes, ${pngBuffers.length} pages`
  );

  return Buffer.from(pdfBytes);
}
