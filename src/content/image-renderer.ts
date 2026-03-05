import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import fs from "fs";
import path from "path";

export interface ImageData {
  type: "freebie" | "news";
  headline: string;
  subtitle: string;
  points?: string[];
  category?: string;
  template?: string; // auto-assigned if not set
}

// ── Font loading ────────────────────────────────────────────────────
const FONTS_DIR = path.resolve(__dirname, "fonts");

function loadFont(filename: string, name: string, weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900) {
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

// ── Brand constants ─────────────────────────────────────────────────
const B = {
  black: "#000000",
  dark1: "#0a0a0a",
  dark2: "#111111",
  dark3: "#0d0d0d",
  white: "#ffffff",
  offWhite: "#f5f5f0",
  cream: "#fdf6e3",
  warmGray: "#e8e4df",
  gray: "#888888",
  lightGray: "#aaaaaa",
  darkGray: "#333333",
  border: "#1a1a1a",
  cyan: "#0693e3",
  purple: "#9b51e0",
  green: "#7bdcb5",
  copper: "#c8956c",
  amber: "#f5a623",
  teal: "#2dd4bf",
};

const W = 1200;
const H = 628;

// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE 1: Bold Dark Typography
// Inspired by: "Set up Claude once" — large text, dark bg, accent word
// ═══════════════════════════════════════════════════════════════════════
function buildBoldTypography(d: ImageData): any {
  // Split headline to highlight last word in accent color
  const words = d.headline.split(" ");
  const mainWords = words.slice(0, -1).join(" ");
  const accentWord = words[words.length - 1];

  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", width: W, height: H, backgroundImage: "linear-gradient(160deg, #0a0a1a, #111128, #0a0a1a)", fontFamily: "Inter", padding: "60px 80px", justifyContent: "center" },
      children: [
        // Top accent line
        { type: "div", props: { style: { display: "flex", width: 60, height: 4, backgroundColor: B.copper, marginBottom: 24 } } },
        // Small label
        { type: "div", props: { style: { display: "flex", fontSize: 14, fontWeight: 600, color: B.copper, letterSpacing: 3, marginBottom: 32 }, children: (d.category || "THE GROWTH ENGINE").toUpperCase() } },
        // Main headline
        { type: "div", props: { style: { display: "flex", fontSize: 64, fontWeight: 700, fontFamily: "Poppins", color: B.white, lineHeight: 1.1, marginBottom: 8 }, children: mainWords } },
        // Accent word
        { type: "div", props: { style: { display: "flex", fontSize: 64, fontWeight: 700, fontFamily: "Poppins", color: B.copper, lineHeight: 1.1, marginBottom: 32 }, children: accentWord + "." } },
        // Subtitle
        { type: "div", props: { style: { display: "flex", fontSize: 18, color: B.lightGray, fontWeight: 400, lineHeight: 1.5, maxWidth: 600 }, children: d.subtitle } },
        // Footer
        { type: "div", props: { style: { display: "flex", position: "absolute", bottom: 40, left: 80, fontSize: 12, color: "#444444", letterSpacing: 1 }, children: "thegrowthengine.net" } },
      ],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE 2: Framework Grid (2x2)
// Inspired by: "4 High-Converting Script Frameworks" — numbered cards
// ═══════════════════════════════════════════════════════════════════════
function buildFrameworkGrid(d: ImageData): any {
  const pts = d.points || ["Step one", "Step two", "Step three", "Step four"];
  const gridColors = ["#1a2332", "#1a2332", "#1a2332", "#1a2332"];

  const cards = pts.slice(0, 4).map((point, i) => ({
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", flex: 1, backgroundColor: gridColors[i], borderRadius: 12, padding: "24px 28px", gap: 12, border: `1px solid ${B.border}` },
      children: [
        // Number + title row
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
            children: [
              { type: "div", props: { style: { display: "flex", fontSize: 16, fontWeight: 700, color: B.white, lineHeight: 1.3, flex: 1 }, children: point } },
              { type: "div", props: { style: { display: "flex", fontSize: 32, fontWeight: 700, fontFamily: "Poppins", color: "rgba(6, 147, 227, 0.3)" }, children: `0${i + 1}` } },
            ],
          },
        },
      ],
    },
  }));

  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", width: W, height: H, backgroundColor: B.black, fontFamily: "Inter", padding: "48px 56px" },
      children: [
        // Title
        { type: "div", props: { style: { display: "flex", fontSize: 36, fontWeight: 700, fontFamily: "Poppins", color: B.white, marginBottom: 8, lineHeight: 1.2 }, children: d.headline } },
        // Subtitle
        { type: "div", props: { style: { display: "flex", fontSize: 16, color: B.gray, marginBottom: 32 }, children: d.subtitle } },
        // Top row
        { type: "div", props: { style: { display: "flex", flexDirection: "row", gap: 16, flex: 1 }, children: [cards[0], cards[1]] } },
        // Spacer
        { type: "div", props: { style: { display: "flex", height: 16 } } },
        // Bottom row
        { type: "div", props: { style: { display: "flex", flexDirection: "row", gap: 16, flex: 1 }, children: [cards[2], cards[3]] } },
        // Footer
        { type: "div", props: { style: { display: "flex", justifyContent: "flex-end", marginTop: 16 }, children: { type: "div", props: { style: { display: "flex", fontSize: 11, color: "#444444", letterSpacing: 1 }, children: "thegrowthengine.net" } } } },
      ],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE 3: Stats/Data Card
// Inspired by: Analytics dashboard — dark bg, metric boxes, green accents
// ═══════════════════════════════════════════════════════════════════════
function buildStatsCard(d: ImageData): any {
  const pts = d.points || ["Metric 1", "Metric 2", "Metric 3", "Metric 4"];

  const statCards = pts.slice(0, 4).map((point, i) => ({
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", flex: 1, backgroundColor: "#111118", borderRadius: 12, padding: "24px 20px", gap: 8, border: `1px solid #222233` },
      children: [
        { type: "div", props: { style: { display: "flex", fontSize: 12, fontWeight: 600, color: B.gray, letterSpacing: 1 }, children: `STEP ${i + 1}` } },
        { type: "div", props: { style: { display: "flex", fontSize: 18, fontWeight: 700, color: B.white, lineHeight: 1.3 }, children: point } },
        // Accent bar at bottom
        { type: "div", props: { style: { display: "flex", width: "100%", height: 3, borderRadius: 2, backgroundImage: `linear-gradient(90deg, ${B.green}, ${B.teal})`, marginTop: 8 } } },
      ],
    },
  }));

  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", width: W, height: H, backgroundColor: "#08080f", fontFamily: "Inter", padding: "52px 56px" },
      children: [
        // Header
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 },
            children: [
              { type: "div", props: { style: { display: "flex", width: 8, height: 8, borderRadius: 4, backgroundColor: B.green } } },
              { type: "div", props: { style: { display: "flex", fontSize: 13, fontWeight: 600, color: B.green, letterSpacing: 2 }, children: (d.category || "FRAMEWORK").toUpperCase() } },
            ],
          },
        },
        // Headline
        { type: "div", props: { style: { display: "flex", fontSize: 40, fontWeight: 700, fontFamily: "Poppins", color: B.white, lineHeight: 1.15, marginBottom: 8 }, children: d.headline } },
        // Subtitle
        { type: "div", props: { style: { display: "flex", fontSize: 16, color: B.lightGray, marginBottom: 36 }, children: d.subtitle } },
        // Stats grid (1 row, 4 cards)
        { type: "div", props: { style: { display: "flex", flexDirection: "row", gap: 14 }, children: statCards } },
        // Footer
        { type: "div", props: { style: { display: "flex", justifyContent: "flex-end", marginTop: "auto", paddingTop: 20 }, children: { type: "div", props: { style: { display: "flex", fontSize: 11, color: "#444444", letterSpacing: 1 }, children: "thegrowthengine.net" } } } },
      ],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE 4: Comparison Split
// Inspired by: "How SEO is viewed" — left vs right comparison
// ═══════════════════════════════════════════════════════════════════════
function buildComparisonSplit(d: ImageData): any {
  const pts = d.points || ["Point 1", "Point 2", "Point 3", "Point 4"];
  const leftPoints = pts.slice(0, 2);
  const rightPoints = pts.slice(2, 4);

  const makeList = (items: string[], color: string, prefix: string) =>
    items.map((item, i) => ({
      type: "div",
      props: {
        style: { display: "flex", flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
        children: [
          { type: "div", props: { style: { display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 12, backgroundColor: color, fontSize: 12, fontWeight: 700, color: B.white, flexShrink: 0 }, children: prefix } },
          { type: "div", props: { style: { display: "flex", fontSize: 16, color: B.white, fontWeight: 400, lineHeight: 1.4 }, children: item } },
        ],
      },
    }));

  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", width: W, height: H, backgroundColor: B.black, fontFamily: "Inter" },
      children: [
        // Title bar
        {
          type: "div",
          props: {
            style: { display: "flex", justifyContent: "center", alignItems: "center", padding: "32px 0 24px", borderBottom: `1px solid ${B.border}` },
            children: { type: "div", props: { style: { display: "flex", fontSize: 36, fontWeight: 700, fontFamily: "Poppins", color: B.white, textAlign: "center" }, children: d.headline } },
          },
        },
        // Split area
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "row", flex: 1 },
            children: [
              // Left side (the wrong way — red tint)
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column", flex: 1, padding: "36px 48px", backgroundColor: "#0f0a0a", borderRight: `1px solid ${B.border}` },
                  children: [
                    { type: "div", props: { style: { display: "flex", fontSize: 13, fontWeight: 700, color: "#e55c5c", letterSpacing: 2, marginBottom: 24 }, children: "WHAT MOST DO" } },
                    ...makeList(leftPoints, "#e55c5c", "X"),
                  ],
                },
              },
              // Right side (the right way — green tint)
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column", flex: 1, padding: "36px 48px", backgroundColor: "#0a0f0a" },
                  children: [
                    { type: "div", props: { style: { display: "flex", fontSize: 13, fontWeight: 700, color: B.green, letterSpacing: 2, marginBottom: 24 }, children: "WHAT WORKS" } },
                    ...makeList(rightPoints, B.green, "✓"),
                  ],
                },
              },
            ],
          },
        },
        // Subtitle + footer
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: "16px 48px", borderTop: `1px solid ${B.border}` },
            children: [
              { type: "div", props: { style: { display: "flex", fontSize: 14, color: B.gray }, children: d.subtitle } },
              { type: "div", props: { style: { display: "flex", fontSize: 11, color: "#444444", letterSpacing: 1 }, children: "thegrowthengine.net" } },
            ],
          },
        },
      ],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE 5: Minimal Statement
// Inspired by: LinkedIn + Gemini card — clean, centered, minimal
// ═══════════════════════════════════════════════════════════════════════
function buildMinimalStatement(d: ImageData): any {
  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", width: W, height: H, backgroundImage: "linear-gradient(160deg, #0e1117, #151a24, #0e1117)", fontFamily: "Inter", justifyContent: "center", alignItems: "center", padding: "60px 80px" },
      children: [
        // Category pill
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center", padding: "8px 20px", backgroundColor: "rgba(6, 147, 227, 0.12)", borderRadius: 24, border: `1px solid rgba(6, 147, 227, 0.3)`, marginBottom: 40 },
            children: { type: "div", props: { style: { display: "flex", fontSize: 13, fontWeight: 600, color: B.cyan, letterSpacing: 2 }, children: (d.category || "THE GROWTH ENGINE").toUpperCase() } },
          },
        },
        // Headline
        { type: "div", props: { style: { display: "flex", fontSize: 52, fontWeight: 700, fontFamily: "Poppins", color: B.white, textAlign: "center", lineHeight: 1.15, maxWidth: 900, marginBottom: 20 }, children: d.headline } },
        // Divider
        { type: "div", props: { style: { display: "flex", width: 60, height: 3, borderRadius: 2, backgroundImage: `linear-gradient(90deg, ${B.cyan}, ${B.purple})`, marginBottom: 20 } } },
        // Subtitle
        { type: "div", props: { style: { display: "flex", fontSize: 20, color: B.lightGray, fontWeight: 400, textAlign: "center", lineHeight: 1.5, maxWidth: 700 }, children: d.subtitle } },
        // Footer
        { type: "div", props: { style: { display: "flex", position: "absolute", bottom: 28, fontSize: 11, color: "#444444", letterSpacing: 1 }, children: "thegrowthengine.net" } },
      ],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE 6: Notion Mockup (existing freebie card)
// ═══════════════════════════════════════════════════════════════════════
function buildNotionMockup(d: ImageData): any {
  const navItems = ["Dashboard", "Projects", "Research", "Analytics"];
  const activeLabel = d.headline.length > 22 ? d.headline.slice(0, 22) + "..." : d.headline;

  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", width: W, height: H, backgroundColor: B.black, fontFamily: "Inter" },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "row", alignItems: "center", height: 40, backgroundColor: B.border, paddingLeft: 16, gap: 8 },
            children: [
              { type: "div", props: { style: { display: "flex", width: 12, height: 12, borderRadius: 6, backgroundColor: "#ff5f57" } } },
              { type: "div", props: { style: { display: "flex", width: 12, height: 12, borderRadius: 6, backgroundColor: "#febc2e" } } },
              { type: "div", props: { style: { display: "flex", width: 12, height: 12, borderRadius: 6, backgroundColor: "#28c840" } } },
              { type: "div", props: { style: { display: "flex", flex: 1, justifyContent: "center", color: "#555555", fontSize: 13, fontWeight: 400 }, children: "The Growth Engine" } },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "row", flex: 1 },
            children: [
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column", width: 240, backgroundColor: B.dark3, padding: "24px 0", gap: 4, borderRight: `1px solid ${B.border}` },
                  children: [
                    ...navItems.map((item) => ({ type: "div", props: { style: { display: "flex", alignItems: "center", padding: "10px 20px", fontSize: 14, color: "#555555", fontWeight: 400 }, children: item } })),
                    { type: "div", props: { style: { display: "flex", alignItems: "center", padding: "10px 20px", fontSize: 14, color: B.cyan, fontWeight: 600, borderLeft: `3px solid ${B.cyan}`, backgroundColor: "rgba(6, 147, 227, 0.08)" }, children: activeLabel } },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column", flex: 1, backgroundColor: B.dark2, padding: "40px 48px", gap: 20 },
                  children: [
                    { type: "div", props: { style: { display: "flex", fontSize: 32, fontWeight: 700, fontFamily: "Poppins", color: B.white, lineHeight: 1.2 }, children: d.headline } },
                    { type: "div", props: { style: { display: "flex", fontSize: 16, color: B.gray, fontWeight: 400, lineHeight: 1.4 }, children: d.subtitle } },
                    { type: "div", props: { style: { display: "flex", width: "100%", height: 1, backgroundColor: B.border } } },
                    {
                      type: "div",
                      props: {
                        style: { display: "flex", flexDirection: "column", gap: 16, marginTop: 4 },
                        children: (d.points || []).map((point, i) => ({
                          type: "div",
                          props: {
                            style: { display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 14 },
                            children: [
                              { type: "div", props: { style: { display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(6, 147, 227, 0.15)", color: B.cyan, fontSize: 14, fontWeight: 700, flexShrink: 0 }, children: String(i + 1) } },
                              { type: "div", props: { style: { display: "flex", fontSize: 18, color: B.white, fontWeight: 400, lineHeight: 1.5, paddingTop: 3 }, children: point } },
                            ],
                          },
                        })),
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        { type: "div", props: { style: { display: "flex", justifyContent: "center", padding: "8px 0", backgroundColor: B.black }, children: { type: "div", props: { style: { display: "flex", fontSize: 11, color: B.darkGray, fontWeight: 400, letterSpacing: 1 }, children: "thegrowthengine.net" } } } },
      ],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE 7: Editorial News Card (existing)
// ═══════════════════════════════════════════════════════════════════════
function buildEditorialCard(d: ImageData): any {
  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", width: W, height: H, backgroundColor: B.black, fontFamily: "Inter" },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 80, backgroundImage: `linear-gradient(135deg, ${B.cyan}, ${B.purple})`, padding: "0 40px" },
            children: [
              { type: "div", props: { style: { display: "flex", alignItems: "center", padding: "6px 16px", backgroundColor: "rgba(255, 255, 255, 0.2)", borderRadius: 20, fontSize: 13, fontWeight: 700, color: B.white, letterSpacing: 2 }, children: (d.category || "AI MARKETING").toUpperCase() } },
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "row", gap: 6 },
                  children: [
                    { type: "div", props: { style: { display: "flex", width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.4)" } } },
                    { type: "div", props: { style: { display: "flex", width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.3)" } } },
                    { type: "div", props: { style: { display: "flex", width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)" } } },
                  ],
                },
              },
            ],
          },
        },
        { type: "div", props: { style: { display: "flex", height: 2, backgroundImage: `linear-gradient(90deg, ${B.cyan}, ${B.purple}, ${B.green})` } } },
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", alignItems: "center", padding: "40px 60px", gap: 20 },
            children: [
              { type: "div", props: { style: { display: "flex", fontSize: 44, fontWeight: 700, fontFamily: "Poppins", color: B.white, textAlign: "center", lineHeight: 1.15, maxWidth: 900 }, children: d.headline } },
              { type: "div", props: { style: { display: "flex", fontSize: 20, color: B.lightGray, fontWeight: 400, textAlign: "center", lineHeight: 1.4, maxWidth: 700 }, children: d.subtitle } },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: "16px 40px", borderTop: `1px solid ${B.border}` },
            children: [
              { type: "div", props: { style: { display: "flex", fontSize: 12, color: "#444444", fontWeight: 400, letterSpacing: 1 }, children: "thegrowthengine.net" } },
              { type: "div", props: { style: { display: "flex", width: 40, height: 3, borderRadius: 2, backgroundImage: `linear-gradient(90deg, ${B.cyan}, ${B.purple})` } } },
            ],
          },
        },
      ],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE SELECTION — random rotation
// ═══════════════════════════════════════════════════════════════════════
const FREEBIE_TEMPLATES = [
  "notion-mockup",
  "bold-typography",
  "framework-grid",
  "stats-card",
  "comparison-split",
  "minimal-statement",
];

const NEWS_TEMPLATES = [
  "editorial-card",
  "bold-typography",
  "minimal-statement",
];

function pickRandomTemplate(postType: "freebie" | "news"): string {
  const pool = postType === "news" ? NEWS_TEMPLATES : FREEBIE_TEMPLATES;
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildTemplate(d: ImageData, template: string): any {
  switch (template) {
    case "bold-typography":   return buildBoldTypography(d);
    case "framework-grid":    return buildFrameworkGrid(d);
    case "stats-card":        return buildStatsCard(d);
    case "comparison-split":  return buildComparisonSplit(d);
    case "minimal-statement": return buildMinimalStatement(d);
    case "editorial-card":    return buildEditorialCard(d);
    case "notion-mockup":
    default:                  return buildNotionMockup(d);
  }
}

// ── Main render function ────────────────────────────────────────────
export async function renderPostImage(imageData: ImageData): Promise<Buffer> {
  const template = imageData.template || pickRandomTemplate(imageData.type);
  console.log(`  [Image] Using template: ${template}`);

  const element = buildTemplate(imageData, template);

  const svg = await satori(element, {
    width: W,
    height: H,
    fonts,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: W },
  });

  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}
