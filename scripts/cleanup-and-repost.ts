import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import axios from "axios";
import { initDb, getPostById, getPostImage } from "../src/storage/db";
import { createTextPost, createImagePost } from "../src/linkedin/post";

const accessToken = process.env.LINKEDIN_ACCESS_TOKEN || "";
const personUrn = process.env.LINKEDIN_PERSON_URN || "";

// Posts to delete (accidental test posts)
const postsToDelete = [
  "urn:li:share:7433953257611505664",  // debug-post.ts accidental post
  "urn:li:share:7433955320357511169",  // test-post-format.ts test post
];

async function deleteLinkedInPost(postUrn: string): Promise<boolean> {
  try {
    const encodedUrn = encodeURIComponent(postUrn);
    const response = await axios.delete(
      `https://api.linkedin.com/rest/posts/${encodedUrn}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "LinkedIn-Version": "202602",
        },
        validateStatus: () => true,
      }
    );
    console.log(`Delete ${postUrn}: status ${response.status}`);
    return response.status >= 200 && response.status < 300;
  } catch (err: any) {
    console.error(`Delete failed for ${postUrn}:`, err.message);
    return false;
  }
}

async function main() {
  await initDb();

  // Step 1: Delete accidental test posts
  console.log("=== Deleting test posts ===");
  for (const urn of postsToDelete) {
    await deleteLinkedInPost(urn);
  }

  // Also delete all previous versions of post #5
  const previousUrns = [
    "urn:li:share:7433946555662893058",  // old repost (truncated)
    "urn:li:share:7433933273342414848",  // original post #5 (truncated)
  ];
  console.log("\n=== Deleting old truncated posts ===");
  for (const urn of previousUrns) {
    await deleteLinkedInPost(urn);
  }

  // Step 2: Repost post #5 with clean content
  console.log("\n=== Reposting post #5 with clean formatting ===");
  const post = await getPostById(5);
  if (!post) {
    console.log("Post #5 not found!");
    process.exit(1);
  }

  // The sanitizeForLinkedIn function in post.ts will clean the content automatically
  console.log("Original content length:", post.content.length);

  try {
    let linkedinPostId: string;
    const imageRecord = await getPostImage(5);
    if (imageRecord && imageRecord.data) {
      console.log("Uploading with image...");
      linkedinPostId = await createImagePost(accessToken, personUrn, post.content, imageRecord.data);
    } else {
      console.log("Text-only post...");
      linkedinPostId = await createTextPost(accessToken, personUrn, post.content);
    }
    console.log("Published! LinkedIn ID:", linkedinPostId);
    console.log("Check at: https://www.linkedin.com/feed/update/" + linkedinPostId);
  } catch (err: any) {
    console.error("Failed:", err.response?.data || err.message);
  }

  process.exit(0);
}

main();
