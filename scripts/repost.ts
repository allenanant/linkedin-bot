import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { initDb, getPostById, getPostImage } from "../src/storage/db";
import { createTextPost, createImagePost } from "../src/linkedin/post";

const accessToken = process.env.LINKEDIN_ACCESS_TOKEN || "";
const personUrn = process.env.LINKEDIN_PERSON_URN || "";
const postId = parseInt(process.argv[2] || "5");

async function main() {
  await initDb();
  const post = await getPostById(postId);
  if (!post) {
    console.log("Post not found:", postId);
    process.exit(1);
  }

  // Strip markdown before posting
  let content = post.content
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/`(.+?)`/g, "$1");

  console.log("Reposting post #" + postId);
  console.log("Content preview:", content.slice(0, 100));

  try {
    let linkedinPostId: string;
    const imageRecord = await getPostImage(postId);
    if (imageRecord && imageRecord.data) {
      console.log("Uploading with image...");
      linkedinPostId = await createImagePost(accessToken, personUrn, content, imageRecord.data);
    } else {
      console.log("Text-only post...");
      linkedinPostId = await createTextPost(accessToken, personUrn, content);
    }
    console.log("Published! LinkedIn ID:", linkedinPostId);
  } catch (err: any) {
    console.error("Failed:", err.response?.data || err.message);
  }
  process.exit(0);
}

main();
