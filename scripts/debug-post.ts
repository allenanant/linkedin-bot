import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { initDb, getPostById, getPostImage } from "../src/storage/db";
import axios from "axios";

const accessToken = process.env.LINKEDIN_ACCESS_TOKEN || "";
const personUrn = process.env.LINKEDIN_PERSON_URN || "";
const postId = parseInt(process.argv[2] || "5");

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/`(.+?)`/g, "$1");
}

async function main() {
  await initDb();
  const post = await getPostById(postId);
  if (!post) {
    console.log("Post not found:", postId);
    process.exit(1);
  }

  const content = stripMarkdown(post.content);

  console.log("=== DEBUG POST #" + postId + " ===");
  console.log("Original content length:", post.content.length);
  console.log("Stripped content length:", content.length);
  console.log("Number of newlines:", (content.match(/\n/g) || []).length);
  console.log("Number of double newlines:", (content.match(/\n\n/g) || []).length);
  console.log("");
  console.log("=== Character Analysis ===");

  // Check for any non-ASCII characters
  const nonAscii = content.match(/[^\x00-\x7F]/g);
  if (nonAscii) {
    console.log("Non-ASCII characters found:", [...new Set(nonAscii)].join(", "));
    console.log("Non-ASCII count:", nonAscii.length);
  } else {
    console.log("No non-ASCII characters found");
  }

  // Check for special whitespace
  const specialWS = content.match(/[\t\r\v\f]/g);
  if (specialWS) {
    console.log("Special whitespace found:", specialWS.map(c => "0x" + c.charCodeAt(0).toString(16)));
  }

  // Check UTF-8 byte length vs char length
  const byteLength = Buffer.byteLength(content, "utf8");
  console.log("UTF-8 byte length:", byteLength);
  console.log("Char length:", content.length);

  console.log("\n=== Full cleaned content ===");
  console.log("---START---");
  console.log(content);
  console.log("---END---");

  // Now actually check what the API payload looks like
  const payload = {
    author: personUrn,
    commentary: content,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  console.log("\n=== API Payload ===");
  console.log("commentary field length:", payload.commentary.length);
  console.log("JSON payload size:", JSON.stringify(payload).length, "bytes");

  // Try posting and capture full response
  console.log("\n=== Attempting to post ===");
  try {
    const response = await axios.post(
      "https://api.linkedin.com/rest/posts",
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
          "LinkedIn-Version": "202602",
        },
        // Capture full response
        validateStatus: () => true,
      }
    );

    console.log("Response status:", response.status);
    console.log("Response headers:", JSON.stringify(response.headers, null, 2));
    console.log("Response data:", JSON.stringify(response.data, null, 2));

    const postUrn = response.headers["x-restli-id"] || response.data?.id || "unknown";
    console.log("\nPost URN:", postUrn);

    if (response.status >= 200 && response.status < 300) {
      console.log("SUCCESS! Post created.");
    } else {
      console.log("FAILED! Status:", response.status);
    }
  } catch (err: any) {
    console.error("Request error:", err.message);
    if (err.response) {
      console.error("Response:", err.response.status, err.response.data);
    }
  }

  process.exit(0);
}

main();
