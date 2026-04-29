/**
 * One-shot helper: seed a published post into the local SQLite DB.
 * Used after the SQLite migration to re-create entries the orchestrator needs (e.g., CORPUS).
 *
 * Usage:
 *   npx tsx scripts/seed-published-post.ts \
 *     --activity 7455224531927027713 \
 *     --keyword CORPUS \
 *     --title "TGE Corpus Playbook" \
 *     --pdf /home/allen-thomas/linkedin-lead-magnets/CORPUS.pdf \
 *     --content-file /tmp/corpus-post.txt \
 *     --posted-at "2026-04-29 17:30:00"
 */
import fs from "fs";
import { initDb, savePost, markPostPublished, saveLeadMagnetPath } from "../src/storage/db";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  await initDb();

  const activityId = arg("activity");
  const keyword = arg("keyword");
  const title = arg("title") || "";
  const pdf = arg("pdf");
  const contentFile = arg("content-file");
  const postedAt = arg("posted-at");

  if (!activityId || !keyword || !contentFile) {
    console.error(
      "Required: --activity <numeric_urn> --keyword <CTA> --content-file <path-to-text>"
    );
    process.exit(1);
  }
  if (!fs.existsSync(contentFile)) {
    console.error(`content-file not found: ${contentFile}`);
    process.exit(1);
  }
  if (pdf && !fs.existsSync(pdf)) {
    console.error(`pdf not found: ${pdf}`);
    process.exit(1);
  }
  if (!/^\d+$/.test(activityId)) {
    console.error(`activity id must be all digits, got: ${activityId}`);
    process.exit(1);
  }

  const content = fs.readFileSync(contentFile, "utf-8");

  const postId = await savePost({
    content,
    postType: "video",
    status: "draft",
    ctaKeyword: keyword,
    leadMagnetTitle: title,
    voiceMode: "tactical",
    topic: keyword,
  });

  await markPostPublished(postId, activityId, activityId);

  if (pdf) {
    await saveLeadMagnetPath(postId, pdf);
  }

  // If a custom posted_at was specified, override (markPostPublished sets it to NOW)
  if (postedAt) {
    const Database = require("better-sqlite3");
    const path = require("path");
    const dbPath = process.env.SQLITE_DB || path.join(process.cwd(), "data", "linkedin-bot.db");
    const db = new Database(dbPath);
    db.prepare(`UPDATE posts SET posted_at = ? WHERE id = ?`).run(postedAt, postId);
    db.close();
  }

  console.log(`Seeded post #${postId} (keyword=${keyword}, activity=${activityId}, pdf=${pdf || "none"})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
