/**
 * Smoke test for the TS wrapper around scripts/post-via-browser.py.
 *
 * Runs with dryRun=true so it does NOT click Post — just opens the modal and
 * types the text, then asserts the script returned ok=true.
 *
 * Usage: ts-node scripts/test-browser-poster.ts (or after build: node dist/scripts/test-browser-poster.js)
 */
import { postViaBrowser } from "../src/linkedin/post-via-browser";

async function main() {
  const result = await postViaBrowser({
    text: "TS wrapper smoke test — should not actually post (dryRun).",
    dryRun: true,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
