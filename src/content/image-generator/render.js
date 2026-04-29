const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const LOGOS_DIR = path.join(__dirname, "logos");

function getSvgDataUri(logoName) {
  const svgPath = path.join(LOGOS_DIR, `${logoName}.svg`);
  if (!fs.existsSync(svgPath)) return null;
  const svg = fs.readFileSync(svgPath, "utf-8");
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function buildHTML({ tool1, tool2, floatingIcons, style = "glass-dark" }) {
  const t1 = getSvgDataUri(tool1.logo);
  const t2 = getSvgDataUri(tool2.logo);

  const floatingIconsHTML = (floatingIcons || [])
    .map((icon, i) => {
      const uri = getSvgDataUri(icon.logo);
      if (!uri) return "";
      return `<div class="floating-icon" style="top:${icon.top};left:${icon.left};right:${icon.right || "auto"};width:${icon.size || "52px"};height:${icon.size || "52px"};animation-delay:${i * 0.4}s">
        <img src="${uri}" style="width:60%;height:60%"/>
      </div>`;
    })
    .join("\n");

  const styles = {
    "glass-dark": {
      bg: "radial-gradient(ellipse at 30% 40%, #1a1a2e 0%, #0a0a14 60%, #050510 100%)",
      cardBg: "rgba(255,255,255,0.06)",
      cardBorder: "rgba(255,255,255,0.12)",
      cardShadow: "0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
      plusColor: "rgba(255,255,255,0.35)",
      labelColor: "#ffffff",
      glowColor1: tool1.glow || "rgba(232,115,74,0.15)",
      glowColor2: tool2.glow || "rgba(10,102,194,0.15)",
      floatingBg: "rgba(255,255,255,0.07)",
      floatingBorder: "rgba(255,255,255,0.1)",
    },
    "glass-light": {
      bg: "radial-gradient(ellipse at 50% 50%, #f8f8fa 0%, #eeeef2 50%, #e4e4ea 100%)",
      cardBg: "rgba(255,255,255,0.7)",
      cardBorder: "rgba(255,255,255,0.9)",
      cardShadow: "0 20px 60px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)",
      plusColor: "rgba(0,0,0,0.25)",
      labelColor: "#1a1a2e",
      glowColor1: tool1.glow || "rgba(232,115,74,0.1)",
      glowColor2: tool2.glow || "rgba(10,102,194,0.1)",
      floatingBg: "rgba(255,255,255,0.6)",
      floatingBorder: "rgba(0,0,0,0.06)",
    },
  };

  const s = styles[style] || styles["glass-dark"];

  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  body {
    width: 1080px;
    height: 1080px;
    background: ${s.bg};
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Inter', -apple-system, sans-serif;
    overflow: hidden;
    position: relative;
  }

  .glow-1 {
    position: absolute;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: ${s.glowColor1};
    filter: blur(100px);
    top: 30%;
    left: 15%;
    z-index: 0;
  }

  .glow-2 {
    position: absolute;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: ${s.glowColor2};
    filter: blur(100px);
    top: 30%;
    right: 15%;
    z-index: 0;
  }

  .container {
    display: flex;
    align-items: center;
    gap: 48px;
    z-index: 2;
    position: relative;
  }

  .card {
    width: 280px;
    height: 280px;
    background: ${s.cardBg};
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    border: 1.5px solid ${s.cardBorder};
    border-radius: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: ${s.cardShadow};
    position: relative;
  }

  .card img {
    width: 120px;
    height: 120px;
    object-fit: contain;
  }

  .card .shine {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
    border-radius: 36px 36px 0 0;
    background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%);
    pointer-events: none;
  }

  .plus {
    font-size: 48px;
    font-weight: 300;
    color: ${s.plusColor};
    z-index: 2;
  }

  .labels {
    position: absolute;
    bottom: 260px;
    display: flex;
    align-items: center;
    gap: 48px;
    z-index: 2;
  }

  /* Position labels under cards */
  .label-row {
    display: flex;
    align-items: center;
    gap: 48px;
    margin-top: 28px;
    z-index: 2;
  }

  .label {
    width: 280px;
    text-align: center;
    font-size: 32px;
    font-weight: 600;
    color: ${s.labelColor};
    letter-spacing: -0.5px;
  }

  .label-plus {
    font-size: 28px;
    font-weight: 300;
    color: ${s.plusColor};
    width: 48px;
    text-align: center;
  }

  .main-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 2;
  }

  .floating-icon {
    position: absolute;
    border-radius: 50%;
    background: ${s.floatingBg};
    backdrop-filter: blur(20px);
    border: 1px solid ${s.floatingBorder};
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    animation: float 6s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }
</style>
</head>
<body>
  <div class="glow-1"></div>
  <div class="glow-2"></div>

  ${floatingIconsHTML}

  <div class="main-wrapper">
    <div class="container">
      <div class="card">
        <div class="shine"></div>
        <img src="${t1}" />
      </div>
      <div class="plus">+</div>
      <div class="card">
        <div class="shine"></div>
        <img src="${t2}" />
      </div>
    </div>
    <div class="label-row">
      <div class="label">${tool1.name}</div>
      <div class="label-plus">+</div>
      <div class="label">${tool2.name}</div>
    </div>
  </div>
</body>
</html>`;
}

async function renderPostImage(config) {
  const html = buildHTML(config);
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "/Applications/Dia.app/Contents/MacOS/Dia",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "networkidle0" });
  const buffer = await page.screenshot({ type: "png" });
  await browser.close();
  return buffer;
}

module.exports = { renderPostImage, buildHTML };

// CLI usage: node render.js --preview
if (require.main === module) {
  const config = {
    tool1: { logo: "claude", name: "Claude", glow: "rgba(232,115,74,0.2)" },
    tool2: { logo: "linkedin", name: "LinkedIn", glow: "rgba(10,102,194,0.2)" },
    style: "glass-light",
    floatingIcons: [
      { logo: "slack", top: "80px", left: "100px", size: "56px" },
      { logo: "google-drive", top: "140px", left: "60px", size: "48px" },
      { logo: "hubspot", top: "80px", right: "140px", left: "auto", size: "52px" },
      { logo: "notion", top: "120px", right: "60px", left: "auto", size: "50px" },
      { logo: "zapier", top: "180px", left: "180px", size: "44px" },
      { logo: "meta", top: "160px", right: "180px", left: "auto", size: "46px" },
    ],
  };

  (async () => {
    console.log("Rendering preview image...");
    const buf = await renderPostImage(config);
    const out = path.join(__dirname, "preview.png");
    fs.writeFileSync(out, buf);
    console.log(`Saved to ${out} (${(buf.length / 1024).toFixed(0)}KB)`);
  })();
}
