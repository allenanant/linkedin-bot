import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Font,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import fs from "fs";
import path from "path";

// ── Types ──────────────────────────────────────────────────────────

export interface CarouselData {
  hook: string;
  hookAccent?: string;
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

// ── Dimensions (portrait 4:5 for LinkedIn carousel) ────────────────

const W = 1080;
const H = 1350;

// ── Colors ─────────────────────────────────────────────────────────

const c = {
  bg: "#0c0c0c",
  white: "#f5f0e8",
  gold: "#c8a97e",
  goldDim: "#8a7554",
  subtle: "#1e1e1e",
  dim: "#999999",
  darkLine: "#2a2a2a",
};

// ── Register fonts ─────────────────────────────────────────────────

const fontsDir = path.resolve(__dirname, "fonts");

Font.register({
  family: "Inter",
  fonts: [
    { src: path.resolve(fontsDir, "Inter-Regular.ttf"), fontWeight: 400 },
    { src: path.resolve(fontsDir, "Inter-SemiBold.ttf"), fontWeight: 600 },
    { src: path.resolve(fontsDir, "Inter-Bold.ttf"), fontWeight: 700 },
  ],
});

Font.register({
  family: "Poppins",
  fonts: [
    { src: path.resolve(fontsDir, "Poppins-Bold.ttf"), fontWeight: 700 },
  ],
});

// Disable hyphenation (looks weird in carousel slides)
Font.registerHyphenationCallback((word) => [word]);

// ── Headshot rotation: v1 -> v3 -> v5 -> v1 -> ... ────────────────

const HEADSHOT_VARIANTS = ["headshot-v1.png", "headshot-v3.png", "headshot-v5.png"];
const HEADSHOT_INDEX_FILE = path.resolve(__dirname, "../../data/headshot-index.txt");

function getNextHeadshotIndex(): number {
  let idx = 0;
  if (fs.existsSync(HEADSHOT_INDEX_FILE)) {
    idx = parseInt(fs.readFileSync(HEADSHOT_INDEX_FILE, "utf-8").trim(), 10) || 0;
  }
  return idx % HEADSHOT_VARIANTS.length;
}

function advanceHeadshotIndex(): void {
  const current = getNextHeadshotIndex();
  const next = (current + 1) % HEADSHOT_VARIANTS.length;
  fs.writeFileSync(HEADSHOT_INDEX_FILE, String(next), "utf-8");
}

// ── Asset paths ────────────────────────────────────────────────────

function getCoverBgPath(): string {
  const jpgPath = path.resolve(__dirname, "../../assets/cover-bg.jpg");
  const pngPath = path.resolve(__dirname, "../../assets/cover-bg.png");
  if (fs.existsSync(jpgPath)) return jpgPath;
  if (fs.existsSync(pngPath)) return pngPath;
  return "";
}

function getHeadshotPath(): string {
  const idx = getNextHeadshotIndex();
  const filename = HEADSHOT_VARIANTS[idx];
  const headshotPath = path.resolve(__dirname, "../../assets", filename);
  if (fs.existsSync(headshotPath)) {
    console.log(`  [Carousel] Using headshot: ${filename}`);
    return headshotPath;
  }
  const fallback = path.resolve(__dirname, "../../assets/headshot.png");
  if (fs.existsSync(fallback)) return fallback;
  return "";
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
  const words = hook.split(/\s+/);
  const splitAt = Math.max(1, words.length - 4);
  return {
    white: words.slice(0, splitAt).join(" "),
    gold: words.slice(splitAt).join(" "),
  };
}

// ── Shared Components ──────────────────────────────────────────────

const PageDots = ({ current, total }: { current: number; total: number }) => (
  <View style={s.dotsRow}>
    {Array.from({ length: total }, (_, i) => (
      <View
        key={i}
        style={i === current ? s.dotActive : s.dot}
      />
    ))}
  </View>
);

const SwipeHint = () => (
  <View style={s.swipe}>
    <Text style={s.swipeText}>SWIPE</Text>
    <Text style={s.swipeArrow}>{">>"}</Text>
  </View>
);

const BrandBar = ({ author, brand }: { author: string; brand: string }) => (
  <View style={s.brandBar}>
    <Text style={s.brandName}>{author.toUpperCase()}</Text>
    <Text style={s.brandLabel}>{brand}</Text>
  </View>
);

const Separator = () => <View style={s.sep} />;

const CornerAccent = () => <View style={s.cornerAccent} />;

// ══════════════════════════════════════════════════════════════════
// COVER SLIDE
// ══════════════════════════════════════════════════════════════════

const CoverSlide = ({ data, totalPages }: { data: CarouselData; totalPages: number }) => {
  const coverBg = getCoverBgPath();
  const { white, gold } = splitHook(data.hook, data.hookAccent);
  const author = data.authorName || "Allen Anant Thomas";
  const brand = data.brandName || "The Growth Engine";

  return (
    <Page size={[W, H]} style={s.page}>
      {/* Background image */}
      {coverBg ? (
        <Image src={coverBg} style={s.coverBgImage} />
      ) : null}

      {/* No overlay needed - cover image is already dark */}

      <CornerAccent />

      {/* Brand bar */}
      <View style={s.coverBrandWrap}>
        <BrandBar author={author} brand={brand} />
        <Separator />
      </View>

      {/* Hook text */}
      <View style={s.coverTextArea}>
        <Text style={s.coverWhite}>{white}</Text>
        <Text style={s.coverGold}>{gold}</Text>
        <Text style={s.coverSubtitle}>{data.subtitle}</Text>
        <View style={s.coverAccentLine} />
      </View>

      <PageDots current={0} total={totalPages} />
      <SwipeHint />
    </Page>
  );
};

// ══════════════════════════════════════════════════════════════════
// CONTENT SLIDE
// ══════════════════════════════════════════════════════════════════

const ContentSlide = ({
  slide,
  totalSlides,
  pageIndex,
  totalPages,
  author,
  brand,
}: {
  slide: CarouselSlide;
  totalSlides: number;
  pageIndex: number;
  totalPages: number;
  author: string;
  brand: string;
}) => {
  const num = `${slide.number < 10 ? "0" : ""}${slide.number}`;
  const totalNum = `${totalSlides < 10 ? "0" : ""}${totalSlides}`;

  return (
    <Page size={[W, H]} style={s.page}>
      <CornerAccent />

      <BrandBar author={author} brand={brand} />
      <Separator />

      {/* Content area */}
      <View style={s.contentArea}>
        {/* Number row */}
        <View style={s.numRow}>
          <View style={s.numBar} />
          <Text style={s.numText}>{num}</Text>
          <Text style={s.numTotal}>/ {totalNum}</Text>
        </View>

        <Text style={s.slideTitle}>{slide.title}</Text>
        <View style={s.goldLine} />
        <Text style={s.slideBody}>{slide.body}</Text>
      </View>

      {/* Large background watermark number */}
      <Text style={s.bgNumber}>{num}</Text>

      <PageDots current={pageIndex} total={totalPages} />
      <SwipeHint />
    </Page>
  );
};

// ══════════════════════════════════════════════════════════════════
// CTA SLIDE
// ══════════════════════════════════════════════════════════════════

const CtaSlide = ({ data, totalPages }: { data: CarouselData; totalPages: number }) => {
  const author = data.authorName || "Allen Anant Thomas";
  const brand = data.brandName || "The Growth Engine";

  return (
    <Page size={[W, H]} style={s.page}>
      <CornerAccent />

      {/* Decorative rings */}
      <View style={s.bgRing} />
      <View style={s.bgRing2} />

      {/* Center content */}
      <View style={s.ctaCenter}>
        <Text style={s.ctaAuthor}>{author}</Text>
        <Text style={s.ctaBrand}>{brand}</Text>
        <View style={s.ctaLine} />
        <Text style={s.ctaText}>{data.ctaText || "Follow for more"}</Text>
        <Text style={s.ctaSub}>Like  |  Save  |  Repost if this helped</Text>
      </View>

      <PageDots current={totalPages - 1} total={totalPages} />
    </Page>
  );
};

// ══════════════════════════════════════════════════════════════════
// FULL DOCUMENT
// ══════════════════════════════════════════════════════════════════

const CarouselDocument = ({ data }: { data: CarouselData }) => {
  const totalPages = data.slides.length + 2;
  const author = data.authorName || "Allen Anant Thomas";
  const brand = data.brandName || "The Growth Engine";

  return (
    <Document title="LinkedIn Carousel" author={author}>
      <CoverSlide data={data} totalPages={totalPages} />
      {data.slides.map((slide, i) => (
        <ContentSlide
          key={i}
          slide={slide}
          totalSlides={data.slides.length}
          pageIndex={i + 1}
          totalPages={totalPages}
          author={author}
          brand={brand}
        />
      ))}
      <CtaSlide data={data} totalPages={totalPages} />
    </Document>
  );
};

// ══════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  // Page base
  page: {
    width: W,
    height: H,
    backgroundColor: c.bg,
    position: "relative",
    fontFamily: "Inter",
    color: c.white,
  },

  // ── Brand bar ──
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 44,
    paddingLeft: 64,
    paddingRight: 64,
  },
  brandName: {
    fontFamily: "Poppins",
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: 2,
    color: c.white,
  },
  brandLabel: {
    fontSize: 17,
    color: c.goldDim,
    fontWeight: 400,
  },

  // ── Separator ──
  sep: {
    marginTop: 20,
    marginLeft: 64,
    marginRight: 64,
    height: 1,
    backgroundColor: c.goldDim,
  },

  // ── Page dots ──
  dotsRow: {
    position: "absolute",
    bottom: 44,
    left: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: c.subtle,
  },
  dotActive: {
    width: 36,
    height: 10,
    borderRadius: 5,
    backgroundColor: c.gold,
  },

  // ── Swipe hint ──
  swipe: {
    position: "absolute",
    bottom: 44,
    right: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  swipeText: {
    fontSize: 14,
    color: c.dim,
    letterSpacing: 3,
    fontWeight: 600,
  },
  swipeArrow: {
    fontSize: 20,
    color: c.gold,
    fontWeight: 700,
  },

  // ── Corner accent ──
  cornerAccent: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    borderColor: c.goldDim,
    opacity: 0.2,
  },

  // ══ COVER SLIDE ══

  coverBgImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: W,
    height: H,
    objectFit: "cover",
    objectPosition: "center top",
  },
  coverOverlayFull: {
    position: "absolute",
    top: 0,
    left: 0,
    width: W,
    height: H,
    backgroundColor: c.bg,
    opacity: 0.15,
  },
  coverOverlayLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: W * 0.55,
    height: H,
    backgroundColor: c.bg,
    opacity: 0.35,
  },
  coverBrandWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    width: W,
  },
  coverTextArea: {
    position: "absolute",
    top: 0,
    left: 0,
    width: W * 0.65,
    height: H,
    flexDirection: "column",
    justifyContent: "flex-start",
    paddingTop: 140,
    paddingLeft: 64,
    paddingRight: 40,
  },
  coverWhite: {
    fontFamily: "Poppins",
    fontSize: 60,
    fontWeight: 700,
    color: c.white,
    lineHeight: 1.12,
  },
  coverGold: {
    fontFamily: "Poppins",
    fontSize: 60,
    fontWeight: 700,
    color: c.gold,
    lineHeight: 1.12,
    marginTop: 6,
  },
  coverSubtitle: {
    fontSize: 22,
    color: c.dim,
    marginTop: 28,
    lineHeight: 1.4,
    fontWeight: 400,
  },
  coverAccentLine: {
    width: 50,
    height: 4,
    backgroundColor: c.gold,
    borderRadius: 2,
    marginTop: 28,
  },

  // ══ CONTENT SLIDE ══

  contentArea: {
    paddingTop: 72,
    paddingLeft: 64,
    paddingRight: 64,
    paddingBottom: 100,
    flexDirection: "column",
  },
  numRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  numBar: {
    width: 5,
    height: 56,
    backgroundColor: c.gold,
    borderRadius: 3,
    marginRight: 20,
  },
  numText: {
    fontFamily: "Poppins",
    fontSize: 68,
    fontWeight: 700,
    color: c.gold,
    lineHeight: 1,
  },
  numTotal: {
    fontSize: 26,
    color: c.goldDim,
    marginLeft: 8,
  },
  slideTitle: {
    fontFamily: "Poppins",
    fontSize: 44,
    fontWeight: 700,
    color: c.white,
    lineHeight: 1.25,
    marginBottom: 24,
  },
  goldLine: {
    width: 56,
    height: 4,
    backgroundColor: c.gold,
    borderRadius: 2,
    marginBottom: 28,
  },
  slideBody: {
    fontSize: 28,
    color: c.dim,
    lineHeight: 1.7,
    maxWidth: 880,
    fontWeight: 400,
  },
  bgNumber: {
    position: "absolute",
    bottom: 50,
    right: 20,
    fontFamily: "Poppins",
    fontSize: 300,
    fontWeight: 700,
    color: c.subtle,
    opacity: 0.6,
    lineHeight: 1,
  },

  // ══ CTA SLIDE ══

  bgRing: {
    position: "absolute",
    top: H / 2 - 300,
    left: W / 2 - 300,
    width: 600,
    height: 600,
    borderRadius: 300,
    borderWidth: 1,
    borderColor: c.subtle,
    opacity: 0.5,
  },
  bgRing2: {
    position: "absolute",
    top: H / 2 - 225,
    left: W / 2 - 225,
    width: 450,
    height: 450,
    borderRadius: 225,
    borderWidth: 1,
    borderColor: c.subtle,
    opacity: 0.3,
  },
  ctaCenter: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 60,
  },
  ctaAuthor: {
    fontFamily: "Poppins",
    fontSize: 42,
    fontWeight: 700,
    color: c.white,
    marginBottom: 8,
  },
  ctaBrand: {
    fontSize: 22,
    color: c.goldDim,
    marginBottom: 52,
  },
  ctaLine: {
    width: 72,
    height: 3,
    backgroundColor: c.gold,
    borderRadius: 2,
    marginBottom: 52,
  },
  ctaText: {
    fontFamily: "Poppins",
    fontSize: 52,
    fontWeight: 700,
    color: c.gold,
    textAlign: "center",
    lineHeight: 1.3,
    maxWidth: 800,
    marginBottom: 24,
  },
  ctaSub: {
    fontSize: 24,
    color: c.dim,
    textAlign: "center",
  },
});

// ══════════════════════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════════════════════

export async function renderCarouselPdf(data: CarouselData): Promise<Buffer> {
  const totalPages = data.slides.length + 2;
  console.log(`  [Carousel] Rendering ${totalPages} pages via React PDF...`);

  const buffer = await renderToBuffer(
    <CarouselDocument data={data} />
  );

  console.log(`  [Carousel] PDF ready: ${buffer.length} bytes, ${totalPages} pages`);

  // Advance headshot rotation for next carousel
  advanceHeadshotIndex();

  return Buffer.from(buffer);
}
