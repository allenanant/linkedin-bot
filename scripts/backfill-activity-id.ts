/**
 * One-shot backfill: set posts.linkedin_activity_id for posts missing it.
 *
 * Why: posts published before the new post-via-browser wrapper landed didn't
 * persist activity_id. The comment watcher needs it to know which URL to scrape.
 *
 * Usage:
 *   npx tsx scripts/backfill-activity-id.ts                # show candidates, no writes
 *   npx tsx scripts/backfill-activity-id.ts --post 12 --activity 7455224531927027713
 */
import { initDb, setActivityId } from "../src/storage/db";
import { Pool } from "pg";
import { config } from "../src/config";

async function main() {
  const args = process.argv.slice(2);
  const postArg = args.indexOf("--post");
  const actArg = args.indexOf("--activity");

  await initDb();
  const pool = new Pool({
    connectionString: config.database.url,
    ssl: { rejectUnauthorized: false },
  });

  if (postArg === -1 || actArg === -1) {
    // Dry-run: print posts that would be candidates for backfill
    const r = await pool.query(`
      SELECT id, content, status, linkedin_post_id, linkedin_activity_id, cta_keyword, posted_at
      FROM posts
      WHERE status = 'published'
        AND cta_keyword IS NOT NULL
        AND cta_keyword != ''
        AND cta_keyword != 'NONE'
      ORDER BY posted_at DESC
      LIMIT 20
    `);
    console.log("Posts that need an activity_id (and a few that already have one):\n");
    for (const row of r.rows) {
      console.log(
        `#${row.id}  kw=${row.cta_keyword}  activity_id=${row.linkedin_activity_id || "<NULL>"}  ` +
        `linkedin_post_id=${(row.linkedin_post_id || "").slice(0, 40)}  posted=${row.posted_at?.toISOString?.()}`
      );
      console.log(`     content: ${(row.content || "").split("\n")[0].slice(0, 80)}`);
    }
    console.log("\nTo set one:");
    console.log("  npx tsx scripts/backfill-activity-id.ts --post <id> --activity <numeric_urn>");
    process.exit(0);
  }

  const postId = parseInt(args[postArg + 1], 10);
  const activityId = (args[actArg + 1] || "").trim();
  if (!postId || !activityId) {
    console.error("Need --post <id> and --activity <numeric_urn>");
    process.exit(1);
  }
  if (!/^\d+$/.test(activityId)) {
    console.error(`activity id must be all digits (e.g. 7455224531927027713), got: ${activityId}`);
    process.exit(1);
  }

  await setActivityId(postId, activityId);
  console.log(`Set posts.linkedin_activity_id = ${activityId} for post #${postId}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
