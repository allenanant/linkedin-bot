import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { initDb, getPostById } from "../src/storage/db";

function sanitizeForLinkedIn(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^[ \t]+/gm, "")
    .replace(/^(\d+\.)\s{2,}/gm, "$1 ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, ".")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  await initDb();
  const post = await getPostById(5);
  if (!post) { console.log("Not found"); process.exit(1); }

  const sanitized = sanitizeForLinkedIn(post.content);

  console.log("=== ORIGINAL ===");
  console.log("Length:", post.content.length);
  console.log(post.content);

  console.log("\n=== SANITIZED ===");
  console.log("Length:", sanitized.length);
  console.log(sanitized);

  // Character-by-character analysis around truncation point
  // Find "Protect Customer Data" position
  const truncPoint = sanitized.indexOf("Protect Customer Data");
  console.log("\n=== AROUND TRUNCATION POINT (position", truncPoint, ") ===");
  const before = sanitized.substring(truncPoint - 20, truncPoint + 80);
  console.log("Context:", JSON.stringify(before));

  // Check ALL non-ASCII characters
  console.log("\n=== ALL NON-ASCII CHARS ===");
  for (let i = 0; i < sanitized.length; i++) {
    const code = sanitized.charCodeAt(i);
    if (code > 127) {
      console.log(`Position ${i}: char='${sanitized[i]}' code=U+${code.toString(16).padStart(4, '0')} context='...${sanitized.substring(Math.max(0,i-10), i+10)}...'`);
    }
  }

  // Check for any invisible/control characters
  console.log("\n=== CONTROL/INVISIBLE CHARS ===");
  for (let i = 0; i < sanitized.length; i++) {
    const code = sanitized.charCodeAt(i);
    if (code < 32 && code !== 10) { // not regular newline
      console.log(`Position ${i}: code=${code} (0x${code.toString(16)})`);
    }
  }

  // Compare with the CLEAN version that WORKED
  const cleanContent = `Is your marketing AI a secret money pit?
It's silently draining your budget.
And probably leaking customer data, today.

The real threat? Often your own AI tools, not external hackers. Many companies only realize this too late.

I saw a client lose $50K in a single week.
They had no clue until the bill hit.
You need smart controls, fast.

Here's how to lock down AI spend and protect privacy:

1. Stop Budget Bleed Cold
Don't just watch AI spending.
Grab control.
Set real-time limits on AI usage.
Trigger alerts.
Even pause services automatically.
No more "bill shock."
Get predictable returns from your AI.

2. Protect Customer Data For Real
Basic data redaction isn't enough.
It misses too much.
Use smart filters that understand context.
Mask names, payments, everything before AI sees it.
Protect customer trust fiercely.
Avoid huge privacy fines.

3. Manage AI Data Like Gold
AI generates tons of sensitive data.
Manage it like human data.
Automate deletion of old, unnecessary information.
Shrink your attack surface.
Make compliance simple.

AI is a powerful assistant.
But you must govern its wallet and data habits.
Stop the budget drain.
Drive serious REVENUE.
Build unbreakable trust.

Ready to take control?
Comment 'SAFE AI' below.
I'll send you my AI Agent Safety Blueprint with an AI Audit Checklist and practical templates.`;

  console.log("\n=== DIFF BETWEEN SANITIZED AND CLEAN ===");
  const sanLines = sanitized.split('\n');
  const cleanLines = cleanContent.split('\n');
  const maxLines = Math.max(sanLines.length, cleanLines.length);

  for (let i = 0; i < maxLines; i++) {
    const sLine = sanLines[i] || '<<MISSING>>';
    const cLine = cleanLines[i] || '<<MISSING>>';
    if (sLine !== cLine) {
      console.log(`Line ${i+1} DIFFERS:`);
      console.log(`  SANITIZED: ${JSON.stringify(sLine)}`);
      console.log(`  CLEAN:     ${JSON.stringify(cLine)}`);
    }
  }

  process.exit(0);
}

main();
