import {
  initDb,
  getCtaPostsToWatch,
  getSeenProfileUrlsForPost,
  recordSeenComment,
  getSeenComments,
  getAwaitingConnection,
  getReadyToDm,
  expireStaleAwaitingConnection,
  setCommentState,
  findAwaitingByProfileUrls,
  findCommentWatcherByProfile,
  type CommentWatcherRow,
  type CtaPostRow,
} from "../storage/db";
import {
  scrapeComments,
  checkConnectionStatus,
  replyToComment,
  acceptConnections,
  sendDm,
  type ScrapedComment,
  type ConnectionStatus,
} from "../linkedin/comment-watcher-bridge";
import {
  paraphraseConnectRequest,
  paraphraseCasualReply,
  paraphraseDm,
} from "./paraphrase";
import { matchesKeyword } from "./keyword-match";
import { notifyCommentWatcher } from "../notifications/slack";

// Conservative caps so a single hourly run doesn't trigger LinkedIn rate limits.
const MAX_REPLIES_PER_RUN = parseInt(process.env.CW_MAX_REPLIES || "8", 10);
const MAX_DMS_PER_RUN = parseInt(process.env.CW_MAX_DMS || "6", 10);
const SLEEP_BETWEEN_ACTIONS_MS = parseInt(process.env.CW_ACTION_SLEEP_MS || "8000", 10);
const EXPIRE_DAYS = parseInt(process.env.CW_EXPIRE_DAYS || "5", 10);

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] [cw] ${msg}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface RunSummary {
  postsScanned: number;
  newCommentsSeen: number;
  repliesPosted: number;
  connectionsRequested: number;
  connectionsAccepted: number;
  dmsSent: number;
  expired: number;
  errors: string[];
}

export async function runCommentWatcherOnce(): Promise<RunSummary> {
  await initDb();

  const summary: RunSummary = {
    postsScanned: 0,
    newCommentsSeen: 0,
    repliesPosted: 0,
    connectionsRequested: 0,
    connectionsAccepted: 0,
    dmsSent: 0,
    expired: 0,
    errors: [],
  };

  // ── Phase A: scrape comments on all watched CTA posts ──────────────
  const posts = await getCtaPostsToWatch(30);
  summary.postsScanned = posts.length;
  log(`Watching ${posts.length} CTA posts`);

  for (const post of posts) {
    if (!post.linkedin_activity_id) {
      log(`Post #${post.id} has no activity_id; skipping`);
      continue;
    }
    try {
      const seenUrls = await getSeenProfileUrlsForPost(post.id);
      log(`Post #${post.id} (${post.cta_keyword}): scraping comments…`);
      const result = await scrapeComments(post.linkedin_activity_id, 20);
      if (!result.ok) {
        const e = `scrape failed for post #${post.id}: ${result.error}`;
        log(e);
        summary.errors.push(e);
        continue;
      }
      const fresh = (result.comments || []).filter((c) => !seenUrls.has(c.profileUrl));
      log(`Post #${post.id}: ${result.count} comments, ${fresh.length} new`);

      for (const c of fresh) {
        const matched = matchesKeyword(c.text, post.cta_keyword);
        await recordSeenComment({
          postId: post.id,
          commentUrn: c.commentUrn || null,
          commenterName: c.name || "",
          commenterProfileUrl: c.profileUrl,
          commentText: c.text,
          keywordMatched: matched,
        });
        summary.newCommentsSeen++;
      }
    } catch (err: any) {
      const e = `scrape exception for post #${post.id}: ${err.message}`;
      log(e);
      summary.errors.push(e);
    }
  }

  // ── Phase B: triage 'seen' comments ────────────────────────────────
  let repliesLeft = MAX_REPLIES_PER_RUN;
  const seenRows = await getSeenComments();
  log(`Triaging ${seenRows.length} 'seen' rows (cap ${MAX_REPLIES_PER_RUN}/run)`);

  for (const row of seenRows) {
    if (repliesLeft <= 0) break;
    const post = posts.find((p) => p.id === row.post_id);
    if (!post) continue;

    try {
      if (row.keyword_matched) {
        // Keyword commenter — check connection, then either DM or ask to connect
        const conn = await checkConnectionStatus(row.commenter_profile_url);
        if (!conn.ok) {
          await setCommentState(row.id, "seen", { last_error: conn.error || "connection check failed" });
          summary.errors.push(`conn check failed for ${row.commenter_profile_url}: ${conn.error}`);
          continue;
        }
        const status = conn.status as ConnectionStatus;
        log(`  ${row.commenter_profile_url} → ${status} (${conn.evidence || ""})`);

        if (status === "connected") {
          // Send DM directly
          await dispatchDm(row, post, summary);
        } else if (status === "not_connected") {
          // Ask them to connect first
          const ok = await dispatchConnectRequestReply(row, post, summary);
          if (ok) repliesLeft--;
        } else if (status === "pending") {
          // Allen sent or received a request already. Wait for it to land in invitation manager.
          await setCommentState(row.id, "awaiting_connection", { last_error: null });
        } else {
          // self/unknown — log and skip
          await setCommentState(row.id, "seen", { last_error: `connection status: ${status}` });
        }
      } else {
        // Non-keyword commenter — casual reply, no further action
        const ok = await dispatchCasualReply(row, post, summary);
        if (ok) repliesLeft--;
      }
    } catch (err: any) {
      const e = `triage failed for row #${row.id}: ${err.message}`;
      log(e);
      summary.errors.push(e);
      await setCommentState(row.id, "seen", { last_error: err.message.slice(0, 500) });
    }

    await sleep(SLEEP_BETWEEN_ACTIONS_MS);
  }

  // ── Phase C: sweep invitation manager for awaiting_connection profiles ──
  const awaiting = await getAwaitingConnection();
  if (awaiting.length > 0) {
    log(`Sweeping invitation manager for ${awaiting.length} awaiting profiles`);
    const profileUrls = awaiting.map((r) => r.commenter_profile_url);
    const sweep = await acceptConnections(profileUrls);
    if (!sweep.ok) {
      const e = `invitation sweep failed: ${sweep.error}`;
      log(e);
      summary.errors.push(e);
    } else {
      log(`  inspected ${sweep.inspectedCount}, accepted ${sweep.acceptedProfileUrls?.length || 0}`);
      const accepted = sweep.acceptedProfileUrls || [];
      summary.connectionsAccepted += accepted.length;

      // Mark each accepted row as 'connected' so Phase D can DM them
      const acceptedRows = await findAwaitingByProfileUrls(accepted);
      for (const r of acceptedRows) {
        await setCommentState(r.id, "connected", { connection_accepted_at: true });
      }
    }
  }

  // ── Phase D: DM the freebie to anyone in 'connected' state ──────────
  let dmsLeft = MAX_DMS_PER_RUN;
  const ready = await getReadyToDm();
  log(`Ready-to-DM: ${ready.length} (cap ${MAX_DMS_PER_RUN}/run)`);
  for (const row of ready) {
    if (dmsLeft <= 0) break;
    const post = posts.find((p) => p.id === row.post_id);
    if (!post) continue;
    const ok = await dispatchDm(row, post, summary);
    if (ok) dmsLeft--;
    await sleep(SLEEP_BETWEEN_ACTIONS_MS);
  }

  // ── Phase E: expire stale awaiting_connection ───────────────────────
  const expired = await expireStaleAwaitingConnection(EXPIRE_DAYS);
  summary.expired = expired;
  if (expired > 0) log(`Expired ${expired} awaiting_connection rows older than ${EXPIRE_DAYS} days`);

  // ── Phase F: notify Slack ───────────────────────────────────────────
  await notifyCommentWatcher(summary).catch((err) => log(`Slack notify failed: ${err.message}`));

  log(
    `Run complete: posts=${summary.postsScanned} new=${summary.newCommentsSeen} replies=${summary.repliesPosted} ` +
    `requested=${summary.connectionsRequested} accepted=${summary.connectionsAccepted} dms=${summary.dmsSent} ` +
    `expired=${summary.expired} errors=${summary.errors.length}`
  );
  return summary;
}

// ── Helpers ──────────────────────────────────────────────────────────

async function dispatchConnectRequestReply(
  row: CommentWatcherRow,
  post: CtaPostRow,
  summary: RunSummary
): Promise<boolean> {
  try {
    const replyText = await paraphraseConnectRequest({
      commenterName: row.commenter_name,
      leadMagnetTitle: post.lead_magnet_title || "the playbook",
      ctaKeyword: post.cta_keyword,
      postExcerpt: post.content,
    });
    log(`  reply→${row.commenter_name}: "${replyText.slice(0, 80)}…"`);

    const r = await replyToComment({
      activityId: post.linkedin_activity_id!,
      commentUrn: row.comment_urn,
      commenterProfileUrl: row.commenter_profile_url,
      replyText,
    });
    if (!r.ok) {
      summary.errors.push(`reply failed: ${r.error}`);
      await setCommentState(row.id, "seen", { last_error: r.error || "reply failed" });
      return false;
    }
    summary.repliesPosted++;
    summary.connectionsRequested++;
    await setCommentState(row.id, "awaiting_connection", {
      reply_text: replyText,
      reply_posted_at: true,
      last_error: null,
    });
    return true;
  } catch (err: any) {
    summary.errors.push(`connect-reply exception: ${err.message}`);
    await setCommentState(row.id, "seen", { last_error: err.message.slice(0, 500) });
    return false;
  }
}

async function dispatchCasualReply(
  row: CommentWatcherRow,
  post: CtaPostRow,
  summary: RunSummary
): Promise<boolean> {
  try {
    const replyText = await paraphraseCasualReply({
      commenterName: row.commenter_name,
      leadMagnetTitle: post.lead_magnet_title || "",
      ctaKeyword: post.cta_keyword,
      postExcerpt: post.content,
      commentText: row.comment_text,
    });
    log(`  casual→${row.commenter_name}: "${replyText.slice(0, 80)}…"`);

    const r = await replyToComment({
      activityId: post.linkedin_activity_id!,
      commentUrn: row.comment_urn,
      commenterProfileUrl: row.commenter_profile_url,
      replyText,
    });
    if (!r.ok) {
      summary.errors.push(`casual reply failed: ${r.error}`);
      await setCommentState(row.id, "seen", { last_error: r.error || "reply failed" });
      return false;
    }
    summary.repliesPosted++;
    await setCommentState(row.id, "casual_replied", {
      reply_text: replyText,
      reply_posted_at: true,
      last_error: null,
    });
    return true;
  } catch (err: any) {
    summary.errors.push(`casual-reply exception: ${err.message}`);
    await setCommentState(row.id, "seen", { last_error: err.message.slice(0, 500) });
    return false;
  }
}

async function dispatchDm(
  row: CommentWatcherRow,
  post: CtaPostRow,
  summary: RunSummary
): Promise<boolean> {
  try {
    if (!post.lead_magnet_pdf_path) {
      summary.errors.push(`no PDF path for post #${post.id}; cannot DM`);
      await setCommentState(row.id, row.state, { last_error: "missing lead_magnet_pdf_path" });
      return false;
    }
    const dmText = await paraphraseDm({
      commenterName: row.commenter_name,
      leadMagnetTitle: post.lead_magnet_title || "the playbook",
      ctaKeyword: post.cta_keyword,
      postExcerpt: post.content,
    });
    log(`  DM→${row.commenter_name}: "${dmText.slice(0, 80)}…" + ${post.lead_magnet_pdf_path}`);

    const r = await sendDm({
      profileUrl: row.commenter_profile_url,
      message: dmText,
      attachmentPath: post.lead_magnet_pdf_path,
      attachmentName: `${post.cta_keyword}.pdf`,
    });
    if (!r.ok) {
      summary.errors.push(`DM failed: ${r.error}`);
      await setCommentState(row.id, row.state, { last_error: r.error || "DM failed" });
      return false;
    }
    summary.dmsSent++;
    await setCommentState(row.id, "fulfilled", {
      dm_text: dmText,
      dm_sent_at: true,
      last_error: null,
    });
    return true;
  } catch (err: any) {
    summary.errors.push(`DM exception: ${err.message}`);
    await setCommentState(row.id, row.state, { last_error: err.message.slice(0, 500) });
    return false;
  }
}
