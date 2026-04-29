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

export interface LeadMagnetData {
  title: string;
  subtitle: string;
  ctaKeyword: string;
  intro: string;
  steps: LeadMagnetStep[];
  resources: LeadMagnetResource[];
  closingTip?: string;
  authorName?: string;
  brandName?: string;
}

export interface LeadMagnetStep {
  number: number;
  title: string;
  body: string;
  bullets?: string[];
  prompt?: string;
}

export interface LeadMagnetResource {
  label: string;
  detail: string;
}

// ── Page size: US Letter portrait ──────────────────────────────────

const W = 612;
const H = 792;

// ── TGE colors (mirrored from carousel-renderer) ────────────────

const c = {
  bg: "#0c0c0c",
  white: "#f5f0e8",
  gold: "#c8a97e",
  goldDim: "#8a7554",
  subtle: "#1e1e1e",
  dim: "#999999",
  darkLine: "#2a2a2a",
};

// ── Register fonts (reuse carousel fonts dir) ───────────────────────

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

Font.registerHyphenationCallback((word) => [word]);

// ── Shared shells ──────────────────────────────────────────────────

const CornerAccent = () => <View style={s.cornerAccent} />;

const BrandHeader = ({ author, brand }: { author: string; brand: string }) => (
  <View style={s.brandHeader}>
    <Text style={s.brandName}>{author.toUpperCase()}</Text>
    <Text style={s.brandLabel}>{brand}</Text>
  </View>
);

const PageFooter = ({ pageNum, total, ctaKeyword }: { pageNum: number; total: number; ctaKeyword: string }) => (
  <View style={s.footer} fixed>
    <Text style={s.footerCta}>Comment "{ctaKeyword}" on the original post for the next playbook</Text>
    <Text style={s.footerPage}>{pageNum} / {total}</Text>
  </View>
);

// ══════════════════════════════════════════════════════════════════
// COVER PAGE
// ══════════════════════════════════════════════════════════════════

const CoverPage = ({ data, totalPages }: { data: LeadMagnetData; totalPages: number }) => {
  const author = data.authorName || "Allen Anant Thomas";
  const brand = data.brandName || "The Growth Engine";
  return (
    <Page size={[W, H]} style={s.page}>
      <CornerAccent />
      <BrandHeader author={author} brand={brand} />
      <View style={s.sep} />

      <View style={s.coverArea}>
        <Text style={s.coverTag}>FREE PLAYBOOK</Text>
        <Text style={s.coverTitle}>{data.title}</Text>
        <Text style={s.coverSubtitle}>{data.subtitle}</Text>
        <View style={s.goldBar} />
        <Text style={s.coverByline}>by {author}, founder of {brand}</Text>
      </View>

      <View style={s.coverFootBlock}>
        <Text style={s.coverFootLabel}>READ TIME</Text>
        <Text style={s.coverFootValue}>~5 minutes. Read it once, apply it today.</Text>
      </View>

      <PageFooter pageNum={1} total={totalPages} ctaKeyword={data.ctaKeyword} />
    </Page>
  );
};

// ══════════════════════════════════════════════════════════════════
// INTRO PAGE
// ══════════════════════════════════════════════════════════════════

const IntroPage = ({ data, pageNum, totalPages }: { data: LeadMagnetData; pageNum: number; totalPages: number }) => {
  const author = data.authorName || "Allen Anant Thomas";
  const brand = data.brandName || "The Growth Engine";
  return (
    <Page size={[W, H]} style={s.page}>
      <CornerAccent />
      <BrandHeader author={author} brand={brand} />
      <View style={s.sep} />

      <View style={s.contentArea}>
        <Text style={s.sectionLabel}>WHY THIS MATTERS</Text>
        <Text style={s.h1}>The setup</Text>
        <View style={s.goldLine} />
        <Text style={s.body}>{data.intro}</Text>
      </View>

      <PageFooter pageNum={pageNum} total={totalPages} ctaKeyword={data.ctaKeyword} />
    </Page>
  );
};

// ══════════════════════════════════════════════════════════════════
// STEP PAGE
// ══════════════════════════════════════════════════════════════════

const StepPage = ({
  step,
  totalSteps,
  pageNum,
  totalPages,
  ctaKeyword,
  author,
  brand,
}: {
  step: LeadMagnetStep;
  totalSteps: number;
  pageNum: number;
  totalPages: number;
  ctaKeyword: string;
  author: string;
  brand: string;
}) => {
  const num = `${step.number < 10 ? "0" : ""}${step.number}`;
  const totalNum = `${totalSteps < 10 ? "0" : ""}${totalSteps}`;

  return (
    <Page size={[W, H]} style={s.page}>
      <CornerAccent />
      <BrandHeader author={author} brand={brand} />
      <View style={s.sep} />

      <View style={s.contentArea}>
        <View style={s.stepNumRow}>
          <View style={s.stepNumBar} />
          <Text style={s.stepNumText}>{num}</Text>
          <Text style={s.stepNumTotal}>/ {totalNum}</Text>
        </View>
        <Text style={s.h1}>{step.title}</Text>
        <View style={s.goldLine} />
        <Text style={s.body}>{step.body}</Text>

        {step.bullets && step.bullets.length > 0 && (
          <View style={s.bulletList}>
            {step.bullets.map((b, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        )}

        {step.prompt && (
          <View style={s.promptBox}>
            <Text style={s.promptLabel}>COPY-PASTE PROMPT</Text>
            <Text style={s.promptText}>{step.prompt}</Text>
          </View>
        )}
      </View>

      <PageFooter pageNum={pageNum} total={totalPages} ctaKeyword={ctaKeyword} />
    </Page>
  );
};

// ══════════════════════════════════════════════════════════════════
// RESOURCES PAGE
// ══════════════════════════════════════════════════════════════════

const ResourcesPage = ({
  data,
  pageNum,
  totalPages,
}: {
  data: LeadMagnetData;
  pageNum: number;
  totalPages: number;
}) => {
  const author = data.authorName || "Allen Anant Thomas";
  const brand = data.brandName || "The Growth Engine";
  return (
    <Page size={[W, H]} style={s.page}>
      <CornerAccent />
      <BrandHeader author={author} brand={brand} />
      <View style={s.sep} />

      <View style={s.contentArea}>
        <Text style={s.sectionLabel}>RESOURCES</Text>
        <Text style={s.h1}>Tools and links you'll need</Text>
        <View style={s.goldLine} />
        <View style={s.resourceList}>
          {data.resources.map((r, i) => (
            <View key={i} style={s.resourceRow}>
              <Text style={s.resourceLabel}>{r.label}</Text>
              <Text style={s.resourceDetail}>{r.detail}</Text>
            </View>
          ))}
        </View>

        {data.closingTip && (
          <View style={s.closingBlock}>
            <Text style={s.closingLabel}>ONE LAST THING</Text>
            <Text style={s.closingBody}>{data.closingTip}</Text>
          </View>
        )}
      </View>

      <PageFooter pageNum={pageNum} total={totalPages} ctaKeyword={data.ctaKeyword} />
    </Page>
  );
};

// ══════════════════════════════════════════════════════════════════
// CLOSING / CTA PAGE
// ══════════════════════════════════════════════════════════════════

const ClosingPage = ({ data, pageNum, totalPages }: { data: LeadMagnetData; pageNum: number; totalPages: number }) => {
  const author = data.authorName || "Allen Anant Thomas";
  const brand = data.brandName || "The Growth Engine";
  return (
    <Page size={[W, H]} style={s.page}>
      <CornerAccent />

      <View style={s.bgRing} />
      <View style={s.bgRing2} />

      <View style={s.closingCenter}>
        <Text style={s.closingAuthor}>{author}</Text>
        <Text style={s.closingBrand}>{brand}</Text>
        <View style={s.closingBar} />
        <Text style={s.closingHeadline}>That's the playbook.</Text>
        <Text style={s.closingSub}>
          If this saved you time, the best thing you can do is share it. Tag a marketer who needs it.
        </Text>
        <View style={{ height: 28 }} />
        <Text style={s.closingCtaLabel}>WANT MORE LIKE THIS?</Text>
        <Text style={s.closingCta}>
          Connect on LinkedIn. I send a new free playbook every week.
        </Text>
      </View>

      <PageFooter pageNum={pageNum} total={totalPages} ctaKeyword={data.ctaKeyword} />
    </Page>
  );
};

// ══════════════════════════════════════════════════════════════════
// FULL DOCUMENT
// ══════════════════════════════════════════════════════════════════

const LeadMagnetDocument = ({ data }: { data: LeadMagnetData }) => {
  const author = data.authorName || "Allen Anant Thomas";
  const brand = data.brandName || "The Growth Engine";
  const totalPages = 1 + 1 + data.steps.length + 1 + 1; // cover + intro + steps + resources + closing

  let pageCounter = 1;
  return (
    <Document title={data.title} author={author}>
      <CoverPage data={data} totalPages={totalPages} />
      <IntroPage data={data} pageNum={++pageCounter} totalPages={totalPages} />
      {data.steps.map((step, i) => (
        <StepPage
          key={i}
          step={step}
          totalSteps={data.steps.length}
          pageNum={++pageCounter}
          totalPages={totalPages}
          ctaKeyword={data.ctaKeyword}
          author={author}
          brand={brand}
        />
      ))}
      <ResourcesPage data={data} pageNum={++pageCounter} totalPages={totalPages} />
      <ClosingPage data={data} pageNum={++pageCounter} totalPages={totalPages} />
    </Document>
  );
};

// ══════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  page: {
    width: W,
    height: H,
    backgroundColor: c.bg,
    position: "relative",
    fontFamily: "Inter",
    color: c.white,
    paddingBottom: 60,
  },

  // Brand header
  brandHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 36,
    paddingLeft: 48,
    paddingRight: 48,
  },
  brandName: {
    fontFamily: "Poppins",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 1.5,
    color: c.white,
  },
  brandLabel: {
    fontSize: 10,
    color: c.goldDim,
  },

  sep: {
    marginTop: 12,
    marginLeft: 48,
    marginRight: 48,
    height: 1,
    backgroundColor: c.goldDim,
  },

  // Corner accent
  cornerAccent: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: c.goldDim,
    opacity: 0.18,
  },

  // Cover
  coverArea: {
    paddingTop: 120,
    paddingLeft: 48,
    paddingRight: 48,
  },
  coverTag: {
    fontSize: 11,
    color: c.gold,
    letterSpacing: 3,
    fontWeight: 700,
    marginBottom: 22,
  },
  coverTitle: {
    fontFamily: "Poppins",
    fontSize: 34,
    fontWeight: 700,
    color: c.white,
    lineHeight: 1.18,
    marginBottom: 16,
  },
  coverSubtitle: {
    fontSize: 14,
    color: c.dim,
    lineHeight: 1.6,
    marginBottom: 22,
    maxWidth: 460,
  },
  goldBar: {
    width: 44,
    height: 3,
    backgroundColor: c.gold,
    marginBottom: 22,
  },
  coverByline: {
    fontSize: 12,
    color: c.goldDim,
  },
  coverFootBlock: {
    position: "absolute",
    bottom: 100,
    left: 48,
    right: 48,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: c.darkLine,
  },
  coverFootLabel: {
    fontSize: 10,
    color: c.gold,
    letterSpacing: 2,
    marginBottom: 6,
  },
  coverFootValue: {
    fontSize: 13,
    color: c.dim,
  },

  // Content area shared
  contentArea: {
    paddingTop: 30,
    paddingLeft: 48,
    paddingRight: 48,
    paddingBottom: 30,
  },
  sectionLabel: {
    fontSize: 10,
    color: c.gold,
    letterSpacing: 2.5,
    fontWeight: 700,
    marginBottom: 10,
  },
  h1: {
    fontFamily: "Poppins",
    fontSize: 22,
    fontWeight: 700,
    color: c.white,
    lineHeight: 1.25,
    marginBottom: 12,
  },
  goldLine: {
    width: 36,
    height: 2.5,
    backgroundColor: c.gold,
    marginBottom: 18,
  },
  body: {
    fontSize: 11.5,
    color: c.white,
    lineHeight: 1.65,
    marginBottom: 14,
  },

  // Step number
  stepNumRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  stepNumBar: {
    width: 3,
    height: 32,
    backgroundColor: c.gold,
    marginRight: 12,
  },
  stepNumText: {
    fontFamily: "Poppins",
    fontSize: 36,
    fontWeight: 700,
    color: c.gold,
    lineHeight: 1,
  },
  stepNumTotal: {
    fontSize: 14,
    color: c.goldDim,
    marginLeft: 6,
  },

  // Bullets
  bulletList: {
    marginTop: 4,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  bulletDot: {
    fontSize: 14,
    color: c.gold,
    marginRight: 10,
    width: 12,
  },
  bulletText: {
    fontSize: 11.5,
    color: c.white,
    lineHeight: 1.55,
    flex: 1,
  },

  // Prompt box
  promptBox: {
    marginTop: 16,
    padding: 18,
    backgroundColor: c.subtle,
    borderLeftWidth: 3,
    borderLeftColor: c.gold,
  },
  promptLabel: {
    fontSize: 9,
    color: c.gold,
    letterSpacing: 2.5,
    fontWeight: 700,
    marginBottom: 8,
  },
  promptText: {
    fontFamily: "Inter",
    fontSize: 10.5,
    color: c.dim,
    lineHeight: 1.55,
  },

  // Resources
  resourceList: {
    marginTop: 4,
  },
  resourceRow: {
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.darkLine,
  },
  resourceLabel: {
    fontFamily: "Poppins",
    fontSize: 13,
    fontWeight: 700,
    color: c.white,
    marginBottom: 4,
  },
  resourceDetail: {
    fontSize: 11,
    color: c.dim,
    lineHeight: 1.5,
  },
  closingBlock: {
    marginTop: 28,
    padding: 18,
    backgroundColor: c.subtle,
    borderLeftWidth: 3,
    borderLeftColor: c.gold,
  },
  closingLabel: {
    fontSize: 9,
    color: c.gold,
    letterSpacing: 2.5,
    fontWeight: 700,
    marginBottom: 8,
  },
  closingBody: {
    fontSize: 11.5,
    color: c.white,
    lineHeight: 1.6,
  },

  // Closing page
  bgRing: {
    position: "absolute",
    top: H / 2 - 200,
    left: W / 2 - 200,
    width: 400,
    height: 400,
    borderRadius: 200,
    borderWidth: 1,
    borderColor: c.subtle,
    opacity: 0.5,
  },
  bgRing2: {
    position: "absolute",
    top: H / 2 - 150,
    left: W / 2 - 150,
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1,
    borderColor: c.subtle,
    opacity: 0.35,
  },
  closingCenter: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 48,
  },
  closingAuthor: {
    fontFamily: "Poppins",
    fontSize: 20,
    fontWeight: 700,
    color: c.white,
    marginBottom: 4,
  },
  closingBrand: {
    fontSize: 11,
    color: c.goldDim,
    marginBottom: 36,
  },
  closingBar: {
    width: 48,
    height: 2.5,
    backgroundColor: c.gold,
    marginBottom: 36,
  },
  closingHeadline: {
    fontFamily: "Poppins",
    fontSize: 24,
    fontWeight: 700,
    color: c.gold,
    textAlign: "center",
    lineHeight: 1.3,
    marginBottom: 16,
  },
  closingSub: {
    fontSize: 12,
    color: c.dim,
    textAlign: "center",
    lineHeight: 1.6,
    maxWidth: 360,
  },
  closingCtaLabel: {
    fontSize: 10,
    color: c.gold,
    letterSpacing: 2.5,
    fontWeight: 700,
    marginBottom: 8,
  },
  closingCta: {
    fontSize: 12,
    color: c.white,
    textAlign: "center",
    lineHeight: 1.5,
    maxWidth: 380,
  },

  // Footer
  footer: {
    position: "absolute",
    left: 48,
    right: 48,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: c.darkLine,
  },
  footerCta: {
    fontSize: 9,
    color: c.dim,
    letterSpacing: 0.5,
  },
  footerPage: {
    fontSize: 9,
    color: c.gold,
    fontFamily: "Poppins",
    fontWeight: 700,
  },
});

// ══════════════════════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════════════════════

export async function renderLeadMagnetPdf(data: LeadMagnetData): Promise<Buffer> {
  console.log(`  [LeadMagnet] Rendering "${data.title}" (${data.steps.length} steps + intro + resources + closing)...`);
  const buffer = await renderToBuffer(<LeadMagnetDocument data={data} />);
  console.log(`  [LeadMagnet] PDF ready: ${buffer.length} bytes`);
  return Buffer.from(buffer);
}
