import { App } from "@slack/bolt";
import { config } from "../config";
import { initDb, getPostById, getPostPdf, getPostImage, markPostPublished, rejectPost, getSlackMessageRef } from "../storage/db";
import { createTextPost, createImagePost, createDocumentPost } from "../linkedin/post";

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

      // Publish to LinkedIn
      let linkedinPostId: string;

      if (post.post_type === "carousel") {
        const pdfData = await getPostPdf(postId);
        if (pdfData) {
          linkedinPostId = await createDocumentPost(
            config.linkedin.accessToken,
            config.linkedin.personUrn,
            post.content,
            pdfData
          );
        } else {
          linkedinPostId = await createTextPost(
            config.linkedin.accessToken,
            config.linkedin.personUrn,
            post.content
          );
        }
      } else {
        const imageRecord = await getPostImage(postId);
        if (imageRecord && imageRecord.data) {
          linkedinPostId = await createImagePost(
            config.linkedin.accessToken,
            config.linkedin.personUrn,
            post.content,
            imageRecord.data
          );
        } else {
          linkedinPostId = await createTextPost(
            config.linkedin.accessToken,
            config.linkedin.personUrn,
            post.content
          );
        }
      }

      await markPostPublished(postId, linkedinPostId);

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

startSlackApp().catch((err) => {
  console.error("Failed to start Slack app:", err);
  process.exit(1);
});
