import { config } from "../config";
import { postMessage, uploadFileToThread } from "./api";
import { saveSlackMessageRef } from "../storage/db";

export async function sendDraftToSlack(post: {
  id: number;
  content: string;
  topic: string;
  pdfData?: Buffer | null;
  imageData?: Buffer | null;
  imageMime?: string;
  postType: string;
  batchIndex?: number;
  batchTotal?: number;
}): Promise<void> {
  const channel = config.slack.channelId;
  if (!channel) {
    console.log("[Slack] No SLACK_CHANNEL_ID configured - skipping.");
    return;
  }

  const batchLabel = post.batchIndex && post.batchTotal
    ? ` (${post.batchIndex}/${post.batchTotal})`
    : "";

  const preview = post.content.length > 2800
    ? post.content.slice(0, 2800) + "\n..."
    : post.content;

  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Draft #${post.id}${batchLabel}`,
        emoji: true,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*Topic:* ${post.topic.slice(0, 200)} | *Type:* ${post.postType === "carousel" ? "PDF Carousel" : post.postType === "image" ? "Tool Combo Image" : "Text"}`,
        },
      ],
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: preview,
      },
    },
    { type: "divider" },
    {
      type: "actions",
      block_id: `draft_actions_${post.id}`,
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Approve & Post", emoji: true },
          style: "primary",
          action_id: "approve_post",
          value: String(post.id),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Reject", emoji: true },
          style: "danger",
          action_id: "reject_post",
          value: String(post.id),
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Post #${post.id} | ${new Date().toLocaleString("en-US", { timeZone: config.bot.timezone })}`,
        },
      ],
    },
  ];

  try {
    const result = await postMessage(
      channel,
      `New LinkedIn draft #${post.id} ready for review`,
      blocks
    );

    // Save the Slack message reference so we can update it later
    await saveSlackMessageRef(post.id, result.channel, result.ts);

    // Upload image or PDF in thread if available
    if (post.imageData) {
      await uploadFileToThread(
        result.channel,
        result.ts,
        post.imageData,
        `draft-${post.id}-image.png`
      );
    } else if (post.pdfData) {
      await uploadFileToThread(
        result.channel,
        result.ts,
        post.pdfData,
        `draft-${post.id}-carousel.pdf`
      );
    }

    console.log(`[Slack] Draft #${post.id} sent to channel ${channel}`);
  } catch (err: any) {
    console.error(`[Slack] Failed to send draft #${post.id}: ${err.message}`);
  }
}
