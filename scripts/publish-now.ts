import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { initDb, getApprovedPosts, getPostImage, markPostPublished } from "../src/storage/db";
import { createTextPost, createImagePost } from "../src/linkedin/post";

const accessToken = process.env.LINKEDIN_ACCESS_TOKEN || "";
const personUrn = process.env.LINKEDIN_PERSON_URN || "";

async function main() {
  await initDb();
  const approved = await getApprovedPosts();
  console.log("Approved posts:", approved.length);

  for (const post of approved) {
    console.log("Publishing post #" + post.id + "...");
    console.log("Content preview:", post.content?.slice(0, 100));
    try {
      let linkedinPostId: string;
      const imageRecord = await getPostImage(post.id);
      if (imageRecord && imageRecord.data) {
        console.log("Has image data from DB, uploading...");
        linkedinPostId = await createImagePost(accessToken, personUrn, post.content, imageRecord.data);
      } else if (post.image_path) {
        console.log("Using file path:", post.image_path);
        linkedinPostId = await createImagePost(accessToken, personUrn, post.content, post.image_path);
      } else {
        console.log("Text-only post");
        linkedinPostId = await createTextPost(accessToken, personUrn, post.content);
      }
      await markPostPublished(post.id, linkedinPostId);
      console.log("Published! LinkedIn ID:", linkedinPostId);
    } catch (err: any) {
      console.error("Failed:", err.response?.data || err.message);
    }
  }
  process.exit(0);
}

main();
