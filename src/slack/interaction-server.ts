import express from "express";
import crypto from "crypto";
import { config } from "../config";
import { initDb, getPostById, getPostPdf, getPostImage, markPostPublished, rejectPost, getSlackMessageRef } from "../storage/db";
import { updateMessage, postThreadReply } from "./api";
import { createTextPost, createImagePost, createDocumentPost } from "../linkedin/post";

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function verifySlackSignature(signingSecret: string, timestamp: string, body: string, signature: string): boolean {
  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", signingSecret).update(baseString).digest("hex");
  const expected = `v0=${hmac}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function handleApprove(postId: number, channel: string, messageTs: string): Promise<string> {
  const post = await getPostById(postId);
  if (!post) return "Post not found.";
  if (post.status !== "draft") return `Post #${postId} is already ${post.status}.`;

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

  // Update the Slack message to show it's published
  const ref = await getSlackMessageRef(postId);
  if (ref) {
    await updateMessage(ref.channel, ref.ts, `Post #${postId} published`, [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Post #${postId} published to LinkedIn*\nLinkedIn ID: \`${linkedinPostId}\``,
        },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `Published at ${new Date().toLocaleString("en-US", { timeZone: config.bot.timezone })}` },
        ],
      },
    ]);
  }

  return `Post #${postId} published to LinkedIn.`;
}

async function handleReject(postId: number): Promise<string> {
  const post = await getPostById(postId);
  if (!post) return "Post not found.";
  if (post.status !== "draft") return `Post #${postId} is already ${post.status}.`;

  await rejectPost(postId);

  // Update the Slack message
  const ref = await getSlackMessageRef(postId);
  if (ref) {
    await updateMessage(ref.channel, ref.ts, `Post #${postId} rejected`, [
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
    ]);

    // Ask for feedback in thread
    await postThreadReply(
      ref.channel,
      ref.ts,
      "What didn't you like about this one? Reply here so the bot can learn."
    );
  }

  return `Post #${postId} rejected.`;
}

export async function startInteractionServer(): Promise<void> {
  await initDb();

  const app = express();

  // Slack sends interaction payloads as URL-encoded form data
  // We need the raw body for signature verification
  app.use("/slack/interactions", express.raw({ type: "application/x-www-form-urlencoded" }));
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "linkedin-bot-slack" });
  });

  // Slack interaction endpoint
  app.post("/slack/interactions", async (req, res) => {
    try {
      const rawBody = req.body.toString();
      const timestamp = req.headers["x-slack-request-timestamp"] as string;
      const signature = req.headers["x-slack-signature"] as string;

      // Verify signature
      if (config.slack.signingSecret) {
        const isValid = verifySlackSignature(config.slack.signingSecret, timestamp, rawBody, signature);
        if (!isValid) {
          log("Invalid Slack signature");
          res.status(401).send("Invalid signature");
          return;
        }
      }

      // Parse the payload
      const params = new URLSearchParams(rawBody);
      const payload = JSON.parse(params.get("payload") || "{}");

      if (payload.type !== "block_actions") {
        res.status(200).send();
        return;
      }

      const action = payload.actions?.[0];
      if (!action) {
        res.status(200).send();
        return;
      }

      const postId = parseInt(action.value, 10);
      const actionId = action.action_id;

      // Acknowledge immediately (Slack requires response within 3 seconds)
      res.status(200).json({
        text: actionId === "approve_post"
          ? `Publishing post #${postId}...`
          : `Rejecting post #${postId}...`,
      });

      // Process the action async
      try {
        if (actionId === "approve_post") {
          const result = await handleApprove(postId, payload.channel?.id, payload.message?.ts);
          log(result);
        } else if (actionId === "reject_post") {
          const result = await handleReject(postId);
          log(result);
        }
      } catch (err: any) {
        log(`Action failed: ${err.message}`);
        // Try to notify in Slack
        const ref = await getSlackMessageRef(postId);
        if (ref) {
          await postThreadReply(ref.channel, ref.ts, `Action failed: ${err.message}`);
        }
      }
    } catch (err: any) {
      log(`Interaction handler error: ${err.message}`);
      if (!res.headersSent) res.status(500).send("Internal error");
    }
  });

  const port = config.dashboard.port || 3000;
  app.listen(port, () => {
    log(`Slack interaction server running on port ${port}`);
  });
}

// Direct entry point
startInteractionServer().catch((err) => {
  console.error("Failed to start interaction server:", err);
  process.exit(1);
});
