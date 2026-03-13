import { WebClient } from "@slack/web-api";
import { config } from "../config";

let client: WebClient;

export function getSlackClient(): WebClient {
  if (!client) {
    if (!config.slack.botToken) {
      throw new Error("SLACK_BOT_TOKEN is required for Slack integration");
    }
    client = new WebClient(config.slack.botToken);
  }
  return client;
}

export async function postMessage(
  channel: string,
  text: string,
  blocks: any[]
): Promise<{ ts: string; channel: string }> {
  const slack = getSlackClient();
  const result = await slack.chat.postMessage({ channel, text, blocks });
  return { ts: result.ts as string, channel: result.channel as string };
}

export async function updateMessage(
  channel: string,
  ts: string,
  text: string,
  blocks: any[]
): Promise<void> {
  const slack = getSlackClient();
  await slack.chat.update({ channel, ts, text, blocks });
}

export async function uploadFileToThread(
  channel: string,
  threadTs: string,
  file: Buffer,
  filename: string
): Promise<void> {
  const slack = getSlackClient();
  await slack.filesUploadV2({
    channel_id: channel,
    file,
    filename,
    title: filename,
    thread_ts: threadTs,
  });
}

export async function postThreadReply(
  channel: string,
  threadTs: string,
  text: string
): Promise<void> {
  const slack = getSlackClient();
  await slack.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text,
  });
}
