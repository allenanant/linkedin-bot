import { App } from "@slack/bolt";
import { config } from "../config";
import { initDb, getPostById, getPostPdf, getPostImage, getPostVideo, markPostPublished, rejectPost, getSlackMessageRef, getPostLeadMagnetMeta, saveLeadMagnetPath } from "../storage/db";
import { createTextPost, createImagePost, createDocumentPost, createVideoPost } from "../linkedin/post";
import {
  createTextPostViaBrowser,
  createImagePostViaBrowser,
  createDocumentPostViaBrowser,
  createVideoPostViaBrowser,
} from "../linkedin/post-via-browser";
import { generateLeadMagnet } from "../content/lead-magnet-generator";

// Default ON: posts go through the LinkedIn UI for better algorithmic reach.
// Set USE_BROWSER_POSTING=false to fall back to REST API.
const USE_BROWSER_POSTING = (process.env.USE_BROWSER_POSTING ?? "true").toLowerCase() !== "false";

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function startSlackApp() {
  await initDb();

  const app = new App({
    token: config.slack.botToken,
    signingSecret: config.slack.signingSecret,
    socketMode: true,
    appToken: config.slack.appToken,
  });

  // Handle Approve button
  app.action("approve_post", async ({ ack, action, client, body }) => {
    await ack();

    const postId = parseInt((action as any).value, 10);
    const channel = (body as any).channel?.id;
    const messageTs = (body as any).message?.ts;

    log(`Approve clicked for post #${postId}`);

    try {
      const post = await getPostById(postId);
      if (!post) {
        await client.chat.postMessage({ channel, thread_ts: messageTs, text: `Post #${postId} not found.` });
        return;
      }
      if (post.status !== "draft") {
        await client.chat.postMessage({ channel, thread_ts: messageTs, text: `Post #${postId} is already ${post.status}.` });
        return;
      }

      // Publish to LinkedIn (default: browser UI; falls back to REST API on USE_BROWSER_POSTING=false)
      // Both paths normalize to { linkedinPostId, activityId }; REST path leaves activityId null.
      const apiResult = (id: string) => ({ linkedinPostId: id, activityId: null as string | null });
      let result: { linkedinPostId: string; activityId: string | null };

      if (post.post_type === "video") {
        const videoData = await getPostVideo(postId);
        if (videoData) {
          result = USE_BROWSER_POSTING
            ? await createVideoPostViaBrowser(post.content, videoData)
            : apiResult(await createVideoPost(config.linkedin.accessToken, config.linkedin.personUrn, post.content, videoData));
        } else {
          result = USE_BROWSER_POSTING
            ? await createTextPostViaBrowser(post.content)
            : apiResult(await createTextPost(config.linkedin.accessToken, config.linkedin.personUrn, post.content));
        }
      } else if (post.post_type === "carousel") {
        const pdfData = await getPostPdf(postId);
        if (pdfData) {
          result = USE_BROWSER_POSTING
            ? await createDocumentPostViaBrowser(post.content, pdfData)
            : apiResult(await createDocumentPost(config.linkedin.accessToken, config.linkedin.personUrn, post.content, pdfData));
        } else {
          result = USE_BROWSER_POSTING
            ? await createTextPostViaBrowser(post.content)
            : apiResult(await createTextPost(config.linkedin.accessToken, config.linkedin.personUrn, post.content));
        }
      } else {
        const imageRecord = await getPostImage(postId);
        if (imageRecord && imageRecord.data) {
          result = USE_BROWSER_POSTING
            ? await createImagePostViaBrowser(post.content, imageRecord.data)
            : apiResult(await createImagePost(config.linkedin.accessToken, config.linkedin.personUrn, post.content, imageRecord.data));
        } else {
          result = USE_BROWSER_POSTING
            ? await createTextPostViaBrowser(post.content)
            : apiResult(await createTextPost(config.linkedin.accessToken, config.linkedin.personUrn, post.content));
        }
      }

      const { linkedinPostId, activityId } = result;
      await markPostPublished(postId, linkedinPostId, activityId);

      // Update the original message
      await client.chat.update({
        channel,
        ts: messageTs,
        text: `Post #${postId} published`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Post #${postId} published to LinkedIn*\n\`${linkedinPostId}\``,
            },
          },
          {
            type: "context",
            elements: [
              { type: "mrkdwn", text: `Published at ${new Date().toLocaleString("en-US", { timeZone: config.bot.timezone })}` },
            ],
          },
        ],
      });

      log(`Post #${postId} published to LinkedIn: ${linkedinPostId}`);

      // ─── Lead magnet generation: kicks off after the post goes live ───
      // Runs async so we never block / unwind the publish path. Failures get
      // logged + posted to the Slack thread but don't fail the approve action.
      generatePostLeadMagnet(postId, channel, messageTs, client).catch((e) => {
        log(`Lead magnet generation failed for #${postId}: ${e.message}`);
      });
    } catch (err: any) {
      log(`Approve failed for #${postId}: ${err.message}`);
      await client.chat.postMessage({
        channel,
        thread_ts: messageTs,
        text: `Failed to publish post #${postId}: ${err.message}`,
      });
    }
  });

  // Handle Reject button
  app.action("reject_post", async ({ ack, action, client, body }) => {
    await ack();

    const postId = parseInt((action as any).value, 10);
    const channel = (body as any).channel?.id;
    const messageTs = (body as any).message?.ts;

    log(`Reject clicked for post #${postId}`);

    try {
      const post = await getPostById(postId);
      if (!post) {
        await client.chat.postMessage({ channel, thread_ts: messageTs, text: `Post #${postId} not found.` });
        return;
      }
      if (post.status !== "draft") {
        await client.chat.postMessage({ channel, thread_ts: messageTs, text: `Post #${postId} is already ${post.status}.` });
        return;
      }

      await rejectPost(postId);

      // Update the original message
      await client.chat.update({
        channel,
        ts: messageTs,
        text: `Post #${postId} rejected`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Post #${postId} rejected*`,
            },
          },
          {
            type: "context",
            elements: [
              { type: "mrkdwn", text: `Rejected at ${new Date().toLocaleString("en-US", { timeZone: config.bot.timezone })}` },
            ],
          },
        ],
      });

      // Ask for feedback in thread
      await client.chat.postMessage({
        channel,
        thread_ts: messageTs,
        text: "What didn't you like about this one? Reply here so the bot can learn.",
      });

      log(`Post #${postId} rejected.`);
    } catch (err: any) {
      log(`Reject failed for #${postId}: ${err.message}`);
      await client.chat.postMessage({
        channel,
        thread_ts: messageTs,
        text: `Failed to reject post #${postId}: ${err.message}`,
      });
    }
  });

  await app.start();
  log("Slack Bot connected via Socket Mode");
}

/**
 * Generates the lead-magnet PDF for a published post if it carries a freebie CTA.
 * Triggered async after publish; does not block the approve action.
 */
async function generatePostLeadMagnet(
  postId: number,
  channel: string,
  messageTs: string,
  client: any
): Promise<void> {
  const meta = await getPostLeadMagnetMeta(postId);
  if (!meta) {
    log(`Lead magnet skipped: no metadata for post #${postId}`);
    return;
  }
  const keyword = meta.ctaKeyword;
  if (!keyword || keyword === "NONE" || keyword === "") {
    log(`Lead magnet skipped: post #${postId} has no freebie CTA`);
    return;
  }

  log(`Generating lead magnet for post #${postId} (keyword: ${keyword}, title: ${meta.leadMagnetTitle || "<from post>"})`);

  try {
    const result = await generateLeadMagnet({
      postContent: meta.content,
      topic: meta.topic || keyword,
      ctaKeyword: keyword,
      leadMagnetTitle: meta.leadMagnetTitle || "",
    });
    await saveLeadMagnetPath(postId, result.pdfPath);

    log(`Lead magnet ready at ${result.pdfPath} (${result.bytes} bytes)`);
    await client.chat.postMessage({
      channel,
      thread_ts: messageTs,
      text: `Lead magnet ready: \`${result.pdfPath}\` (${(result.bytes / 1024).toFixed(0)} KB, "${result.data.title}")`,
    });
  } catch (err: any) {
    log(`Lead magnet generation error for #${postId}: ${err.message}`);
    await client.chat.postMessage({
      channel,
      thread_ts: messageTs,
      text: `Lead magnet generation failed for post #${postId}: ${err.message}`,
    });
  }
}

startSlackApp().catch((err) => {
  console.error("Failed to start Slack app:", err);
  process.exit(1);
});
