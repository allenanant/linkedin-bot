import { config } from "../config";
import {
  getPostById,
  getPostPdf,
  getPostImage,
  getPostVideo,
  markPostPublished,
} from "../storage/db";
import {
  createTextPost,
  createImagePost,
  createDocumentPost,
  createVideoPost,
} from "./post";
import {
  createTextPostViaBrowser,
  createImagePostViaBrowser,
  createDocumentPostViaBrowser,
  createVideoPostViaBrowser,
} from "./post-via-browser";

const USE_BROWSER_POSTING =
  (process.env.USE_BROWSER_POSTING ?? "true").toLowerCase() !== "false";

export interface PublishResult {
  linkedinPostId: string;
  activityId: string | null;
}

export async function publishPostToLinkedIn(postId: number): Promise<PublishResult> {
  const post = await getPostById(postId);
  if (!post) throw new Error(`Post #${postId} not found`);
  if (post.status !== "draft") throw new Error(`Post #${postId} is already ${post.status}`);

  const apiResult = (id: string): PublishResult => ({ linkedinPostId: id, activityId: null });
  let result: PublishResult;

  if (post.post_type === "video") {
    const videoData = await getPostVideo(postId);
    if (videoData) {
      result = USE_BROWSER_POSTING
        ? await createVideoPostViaBrowser(post.content, videoData)
        : apiResult(
            await createVideoPost(
              config.linkedin.accessToken,
              config.linkedin.personUrn,
              post.content,
              videoData
            )
          );
    } else {
      result = USE_BROWSER_POSTING
        ? await createTextPostViaBrowser(post.content)
        : apiResult(
            await createTextPost(
              config.linkedin.accessToken,
              config.linkedin.personUrn,
              post.content
            )
          );
    }
  } else if (post.post_type === "carousel") {
    const pdfData = await getPostPdf(postId);
    if (pdfData) {
      result = USE_BROWSER_POSTING
        ? await createDocumentPostViaBrowser(post.content, pdfData)
        : apiResult(
            await createDocumentPost(
              config.linkedin.accessToken,
              config.linkedin.personUrn,
              post.content,
              pdfData
            )
          );
    } else {
      result = USE_BROWSER_POSTING
        ? await createTextPostViaBrowser(post.content)
        : apiResult(
            await createTextPost(
              config.linkedin.accessToken,
              config.linkedin.personUrn,
              post.content
            )
          );
    }
  } else {
    const imageRecord = await getPostImage(postId);
    if (imageRecord && imageRecord.data) {
      result = USE_BROWSER_POSTING
        ? await createImagePostViaBrowser(post.content, imageRecord.data)
        : apiResult(
            await createImagePost(
              config.linkedin.accessToken,
              config.linkedin.personUrn,
              post.content,
              imageRecord.data
            )
          );
    } else {
      result = USE_BROWSER_POSTING
        ? await createTextPostViaBrowser(post.content)
        : apiResult(
            await createTextPost(
              config.linkedin.accessToken,
              config.linkedin.personUrn,
              post.content
            )
          );
    }
  }

  await markPostPublished(postId, result.linkedinPostId, result.activityId);
  return result;
}
