import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import axios from "axios";

const accessToken = process.env.LINKEDIN_ACCESS_TOKEN || "";
const personUrn = process.env.LINKEDIN_PERSON_URN || "";

// Same content as post #5 but with CLEAN formatting:
// - No 4-space indentation
// - No parentheses in headers
// - Using arrow symbols instead of indentation
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

async function main() {
  console.log("Clean content length:", cleanContent.length);
  console.log("Line count:", cleanContent.split('\n').length);
  console.log("Empty lines:", cleanContent.split('\n').filter(l => l.trim() === '').length);
  console.log("\n--- Content ---");
  console.log(cleanContent);
  console.log("--- End ---\n");

  // Check for any problematic characters
  const hasIndentation = /^    /m.test(cleanContent);
  const hasParens = /\(/.test(cleanContent);
  const hasSmartQuotes = /[\u2018\u2019\u201C\u201D]/.test(cleanContent);
  console.log("Has 4-space indentation:", hasIndentation);
  console.log("Has parentheses:", hasParens);
  console.log("Has smart quotes:", hasSmartQuotes);

  console.log("\nPosting to LinkedIn...");
  try {
    const response = await axios.post(
      "https://api.linkedin.com/rest/posts",
      {
        author: personUrn,
        commentary: cleanContent,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
          "LinkedIn-Version": "202602",
        },
        validateStatus: () => true,
      }
    );

    console.log("Status:", response.status);
    const postUrn = response.headers["x-restli-id"] || "unknown";
    console.log("Post URN:", postUrn);

    if (response.status >= 200 && response.status < 300) {
      console.log("SUCCESS!");
      console.log("\nCheck at: https://www.linkedin.com/feed/update/" + postUrn);
    } else {
      console.log("FAILED:", JSON.stringify(response.data));
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  }
  process.exit(0);
}

main();
