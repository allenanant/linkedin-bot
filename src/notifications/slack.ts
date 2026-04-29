import axios from "axios";
import { config } from "../config";

interface SlackNotificationOptions {
  postId: number;
  content: string;
  hasImage: boolean;
  topic?: string;
}

/**
 * Send a Slack notification when a new draft post is ready for approval.
 * Uses Slack Incoming Webhooks — no extra dependencies needed.
 */
export async function notifyDraftReady(opts: SlackNotificationOptions): Promise<void> {
  const webhookUrl = config.slack?.webhookUrl;
  if (!webhookUrl) {
    console.log("[Slack] No SLACK_WEBHOOK_URL configured — skipping notification.");
    return;
  }

  const dashboardUrl = config.slack.dashboardUrl || `http://localhost:${config.dashboard.port}`;
  const preview = opts.content.length > 280
    ? opts.content.slice(0, 280) + "…"
    : opts.content;

  const payload = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📝 New LinkedIn Draft Ready",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Post ID:*\n#${opts.postId}` },
          { type: "mrkdwn", text: `*Type:*\n${opts.hasImage ? "🖼️ Image Post" : "📄 Text Post"}` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Preview:*\n>${preview.replace(/\n/g, "\n>")}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Review in Dashboard", emoji: true },
            url: `${dashboardUrl}/drafts`,
            style: "primary",
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `⏰ ${new Date().toLocaleString("en-US", { timeZone: config.bot.timezone })} · Approve or reject from your dashboard`,
          },
        ],
      },
    ],
  };

  try {
    await axios.post(webhookUrl, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });
    console.log(`[Slack] Notification sent for draft #${opts.postId}`);
  } catch (err: any) {
    // Never let Slack failures break the pipeline
    console.error(`[Slack] Failed to send notification: ${err.message}`);
  }
}

/**
 * Send a Slack notification when a post is published to LinkedIn.
 */
export async function notifyPostPublished(postId: number, linkedinPostId: string): Promise<void> {
  const webhookUrl = config.slack?.webhookUrl;
  if (!webhookUrl) return;

  const payload = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `✅ *Post #${postId} published to LinkedIn!*\nLinkedIn Post ID: \`${linkedinPostId}\``,
        },
      },
    ],
  };

  try {
    await axios.post(webhookUrl, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });
  } catch (err: any) {
    console.error(`[Slack] Failed to send publish notification: ${err.message}`);
  }
}

/**
 * Send a Slack summary after a comment-watcher run.
 * Stays quiet on no-op runs (no new comments, replies, or DMs).
 */
export async function notifyCommentWatcher(summary: {
  postsScanned: number;
  newCommentsSeen: number;
  repliesPosted: number;
  connectionsRequested: number;
  connectionsAccepted: number;
  dmsSent: number;
  expired: number;
  errors: string[];
}): Promise<void> {
  const webhookUrl = config.slack?.webhookUrl;
  if (!webhookUrl) return;

  const hasActivity =
    summary.newCommentsSeen > 0 ||
    summary.repliesPosted > 0 ||
    summary.connectionsAccepted > 0 ||
    summary.dmsSent > 0 ||
    summary.expired > 0 ||
    summary.errors.length > 0;
  if (!hasActivity) return;

  const fields: any[] = [
    { type: "mrkdwn", text: `*Posts scanned:* ${summary.postsScanned}` },
    { type: "mrkdwn", text: `*New comments:* ${summary.newCommentsSeen}` },
    { type: "mrkdwn", text: `*Replies posted:* ${summary.repliesPosted}` },
    { type: "mrkdwn", text: `*Connections requested:* ${summary.connectionsRequested}` },
    { type: "mrkdwn", text: `*Connections accepted:* ${summary.connectionsAccepted}` },
    { type: "mrkdwn", text: `*DMs sent:* ${summary.dmsSent}` },
  ];
  if (summary.expired > 0) {
    fields.push({ type: "mrkdwn", text: `*Expired (5d):* ${summary.expired}` });
  }

  const payload: any = {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Comment Watcher Run", emoji: false },
      },
      { type: "section", fields },
    ],
  };

  if (summary.errors.length > 0) {
    payload.blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Errors (${summary.errors.length}):*\n\`\`\`${summary.errors.slice(0, 5).join("\n").slice(0, 1500)}\`\`\``,
      },
    });
  }

  try {
    await axios.post(webhookUrl, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });
  } catch (err: any) {
    console.error(`[Slack] Failed to send comment-watcher summary: ${err.message}`);
  }
}

/**
 * Send a Slack notification when the pipeline fails.
 */
export async function notifyPipelineError(error: string): Promise<void> {
  const webhookUrl = config.slack?.webhookUrl;
  if (!webhookUrl) return;

  const payload = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🚨 *LinkedIn Bot Pipeline Error*\n\`\`\`${error.slice(0, 500)}\`\`\``,
        },
      },
    ],
  };

  try {
    await axios.post(webhookUrl, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });
  } catch {
    // Silently fail — we're already in an error state
  }
}
