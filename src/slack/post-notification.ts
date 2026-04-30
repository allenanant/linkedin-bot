import { config } from "../config";
import { postMessage, uploadFileToThread } from "./api";

export async function notifyPostPublished(args: {
  postId: number;
  content: string;
  topic: string;
  postType: string;
  linkedinPostId: string;
  activityId?: string | null;
  pdfData?: Buffer | null;
  imageData?: Buffer | null;
  videoData?: Buffer | null;
  batchIndex?: number;
  batchTotal?: number;
}): Promise<void> {
  const channel = config.slack.channelId;
  if (!channel) {
    console.log("[Slack] No SLACK_CHANNEL_ID configured - skipping.");
    return;
  }

  const batchLabel =
    args.batchIndex && args.batchTotal ? ` (${args.batchIndex}/${args.batchTotal})` : "";
  const preview =
    args.content.length > 2800 ? args.content.slice(0, 2800) + "\n..." : args.content;

  const typeLabel =
    args.postType === "carousel"
      ? "PDF Carousel"
      : args.postType === "video"
      ? "Motion Video (MP4)"
      : args.postType === "image"
      ? "Tool Combo Image"
      : "Text";

  const linkedinUrl = args.activityId
    ? `https://www.linkedin.com/feed/update/urn:li:activity:${args.activityId}/`
    : null;

  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Posted #${args.postId}${batchLabel}`,
        emoji: true,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*Topic:* ${args.topic.slice(0, 200)} | *Type:* ${typeLabel}${
            linkedinUrl ? ` | <${linkedinUrl}|View on LinkedIn>` : ""
          }`,
        },
      ],
    },
    { type: "divider" },
    {
      type: "section",
      text: { type: "mrkdwn", text: preview },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Published at ${new Date().toLocaleString("en-US", {
            timeZone: config.bot.timezone,
          })} | LinkedIn ID \`${args.linkedinPostId}\``,
        },
      ],
    },
  ];

  try {
    const result = await postMessage(
      channel,
      `LinkedIn post #${args.postId} published`,
      blocks
    );

    if (args.videoData) {
      await uploadFileToThread(
        result.channel,
        result.ts,
        args.videoData,
        `post-${args.postId}-video.mp4`
      );
    } else if (args.imageData) {
      await uploadFileToThread(
        result.channel,
        result.ts,
        args.imageData,
        `post-${args.postId}-image.png`
      );
    } else if (args.pdfData) {
      await uploadFileToThread(
        result.channel,
        result.ts,
        args.pdfData,
        `post-${args.postId}-carousel.pdf`
      );
    }

    console.log(`[Slack] Published-notification for #${args.postId} sent to ${channel}`);
  } catch (err: any) {
    console.error(`[Slack] Failed to notify for #${args.postId}: ${err.message}`);
  }
}
