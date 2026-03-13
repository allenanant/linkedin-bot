import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { initDb, getPostById } from "../src/storage/db";

async function main() {
  await initDb();
  for (let id = 1; id <= 15; id++) {
    const post = await getPostById(id);
    if (post) {
      console.log(`\n=== Post #${id} ===`);
      console.log("Status:", post.status);
      console.log("LinkedIn ID:", post.linkedin_post_id || "none");
      console.log("Content length:", post.content?.length);
      console.log("Content:\n---START---");
      console.log(post.content);
      console.log("---END---");
    }
  }
  process.exit(0);
}
main();
