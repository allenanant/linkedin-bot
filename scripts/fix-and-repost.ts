import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import axios from "axios";
import { initDb, getPostById, getPostImage } from "../src/storage/db";
import { createTextPost, createImagePost } from "../src/linkedin/post";

const accessToken = process.env.LINKEDIN_ACCESS_TOKEN || "";
const personUrn = process.env.LINKEDIN_PERSON_URN || "";

async function deletePost(urn: string) {
  try {
    const encoded = encodeURIComponent(urn);
    const resp = await axios.delete(`https://api.linkedin.com/rest/posts/${encoded}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": "202602",
      },
      validateStatus: () => true,
    });
    console.log(`Delete ${urn}: ${resp.status}`);
  } catch (e: any) {
    console.log(`Delete failed: ${e.message}`);
  }
}

async function main() {
  await initDb();

  // Delete the truncated repost
  console.log("Deleting truncated post...");
  await deletePost("urn:li:share:7433956098837098497");

  // Repost with fixed sanitizer (now strips parentheses)
  console.log("\nReposting with fixed sanitizer...");
  const post = await getPostById(5);
  if (!post) { console.log("Not found"); process.exit(1); }

  try {
    let linkedinPostId: string;
    const imageRecord = await getPostImage(5);
    if (imageRecord && imageRecord.data) {
      console.log("Uploading with image...");
      linkedinPostId = await createImagePost(accessToken, personUrn, post.content, imageRecord.data);
    } else {
      console.log("Text-only...");
      linkedinPostId = await createTextPost(accessToken, personUrn, post.content);
    }
    console.log("Published!", linkedinPostId);
    console.log("https://www.linkedin.com/feed/update/" + linkedinPostId);
  } catch (err: any) {
    console.error("Failed:", err.response?.data || err.message);
  }

  process.exit(0);
}

main();
