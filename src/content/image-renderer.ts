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
  cardBg: "#111111",
  sidebarBg: "#0d0d0d",
  white: "#ffffff",
  gray: "#888888",
  lightGray: "#aaaaaa",
  darkGray: "#333333",
  border: "#1a1a1a",
  cyan: "#0693e3",
  purple: "#9b51e0",
  green: "#7bdcb5",
};

const W = 1200;
const H = 628;

// ── Freebie Card (Notion-style mockup) ──────────────────────────────
function buildFreebieCard(d: ImageData): any {
  const navItems = ["Dashboard", "Projects", "Research", "Analytics"];
  const activeLabel = d.headline.length > 22 ? d.headline.slice(0, 22) + "..." : d.headline;

  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", width: W, height: H, backgroundColor: B.black, fontFamily: "Inter" },
      children: [
        // ── Window chrome ──
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
        // ── Content area ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "row", flex: 1 },
            children: [
              // Sidebar
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column", width: 240, backgroundColor: B.sidebarBg, padding: "24px 0", gap: 4, borderRight: `1px solid ${B.border}` },
                  children: [
                    ...navItems.map((item) => ({
                      type: "div",
                      props: {
                        style: { display: "flex", alignItems: "center", padding: "10px 20px", fontSize: 14, color: "#555555", fontWeight: 400 },
                        children: item,
                      },
                    })),
                    // Active item
                    {
                      type: "div",
                      props: {
                        style: { display: "flex", alignItems: "center", padding: "10px 20px", fontSize: 14, color: B.cyan, fontWeight: 600, borderLeft: `3px solid ${B.cyan}`, backgroundColor: "rgba(6, 147, 227, 0.08)" },
                        children: activeLabel,
                      },
                    },
                  ],
                },
              },
              // Main content
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column", flex: 1, backgroundColor: B.cardBg, padding: "40px 48px", gap: 20 },
                  children: [
                    // Headline
                    { type: "div", props: { style: { display: "flex", fontSize: 32, fontWeight: 700, fontFamily: "Poppins", color: B.white, lineHeight: 1.2 }, children: d.headline } },
                    // Subtitle
                    { type: "div", props: { style: { display: "flex", fontSize: 16, color: B.gray, fontWeight: 400, lineHeight: 1.4 }, children: d.subtitle } },
                    // Divider
                    { type: "div", props: { style: { display: "flex", width: "100%", height: 1, backgroundColor: B.border } } },
                    // Points
                    {
                      type: "div",
                      props: {
                        style: { display: "flex", flexDirection: "column", gap: 16, marginTop: 4 },
                        children: (d.points || []).map((point, i) => ({
                          type: "div",
                          props: {
                            style: { display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 14 },
                            children: [
                              // Number circle
                              {
                                type: "div",
                                props: {
                                  style: { display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(6, 147, 227, 0.15)", color: B.cyan, fontSize: 14, fontWeight: 700, flexShrink: 0 },
                                  children: String(i + 1),
                                },
                              },
                              // Point text
                              {
                                type: "div",
                                props: {
                                  style: { display: "flex", fontSize: 18, color: B.white, fontWeight: 400, lineHeight: 1.5, paddingTop: 3 },
                                  children: point,
                                },
                              },
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
        // ── Footer ──
        {
          type: "div",
          props: {
            style: { display: "flex", justifyContent: "center", padding: "8px 0", backgroundColor: B.black },
            children: {
              type: "div",
              props: { style: { display: "flex", fontSize: 11, color: B.darkGray, fontWeight: 400, letterSpacing: 1 }, children: "thegrowthengine.net" },
            },
          },
        },
      ],
    },
  };
}

// ── News Card (editorial style) ─────────────────────────────────────
function buildNewsCard(d: ImageData): any {
  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", width: W, height: H, backgroundColor: B.black, fontFamily: "Inter" },
      children: [
        // ── Gradient accent bar ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 80, backgroundImage: `linear-gradient(135deg, ${B.cyan}, ${B.purple})`, padding: "0 40px" },
            children: [
              // Category badge
              {
                type: "div",
                props: {
                  style: { display: "flex", alignItems: "center", padding: "6px 16px", backgroundColor: "rgba(255, 255, 255, 0.2)", borderRadius: 20, fontSize: 13, fontWeight: 700, color: B.white, letterSpacing: 2 },
                  children: (d.category || "AI MARKETING").toUpperCase(),
                },
              },
              // Decorative dots
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
        // ── Thin accent line ──
        {
          type: "div",
          props: { style: { display: "flex", height: 2, backgroundImage: `linear-gradient(90deg, ${B.cyan}, ${B.purple}, ${B.green})` } },
        },
        // ── Main content ──
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", alignItems: "center", padding: "40px 60px", gap: 20 },
            children: [
              // Headline
              { type: "div", props: { style: { display: "flex", fontSize: 44, fontWeight: 700, fontFamily: "Poppins", color: B.white, textAlign: "center", lineHeight: 1.15, maxWidth: 900 }, children: d.headline } },
              // Subtitle
              { type: "div", props: { style: { display: "flex", fontSize: 20, color: B.lightGray, fontWeight: 400, textAlign: "center", lineHeight: 1.4, maxWidth: 700 }, children: d.subtitle } },
            ],
          },
        },
        // ── Footer ──
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

// ── Main render function ────────────────────────────────────────────
export async function renderPostImage(imageData: ImageData): Promise<Buffer> {
  const element = imageData.type === "news" ? buildNewsCard(imageData) : buildFreebieCard(imageData);

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
