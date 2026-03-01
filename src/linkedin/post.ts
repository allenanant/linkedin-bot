import axios from "axios";
import fs from "fs";
import path from "path";

const LINKEDIN_API = "https://api.linkedin.com";

// LinkedIn SILENTLY TRUNCATES posts that contain parentheses or indented lines.
// This is the last safety net before content hits the API.
function sanitizeForLinkedIn(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")       // strip bold markdown
    .replace(/\*(.+?)\*/g, "$1")            // strip italic markdown
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^[ \t]+/gm, "")              // CRITICAL: remove all leading whitespace
    .replace(/^(\d+\.)\s{2,}/gm, "$1 ")    // fix double-space after numbers
    .replace(/\(([^)]*)\)/g, "$1")          // CRITICAL: remove parentheses but keep text inside
    .replace(/[\u2018\u2019]/g, "'")        // smart quotes → plain
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, ".")                // em-dash → period
    .replace(/\n{3,}/g, "\n\n")            // collapse excessive newlines
    .trim();
}

export async function createTextPost(
  accessToken: string,
  personUrn: string,
  text: string
): Promise<string> {
  const cleanText = sanitizeForLinkedIn(text);
  const response = await axios.post(
    `${LINKEDIN_API}/rest/posts`,
    {
      author: personUrn,
      commentary: cleanText,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": "202602",
      },
    }
  );

  // LinkedIn returns the post URN in the x-restli-id header
  const postId = response.headers["x-restli-id"] || response.data?.id || "unknown";
  return postId;
}

export async function uploadImage(
  accessToken: string,
  personUrn: string,
  imageSource: string | Buffer
): Promise<string> {
  // Step 1: Initialize the upload
  const initResponse = await axios.post(
    `${LINKEDIN_API}/rest/images?action=initializeUpload`,
    {
      initializeUploadRequest: {
        owner: personUrn,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": "202602",
      },
    }
  );

  const { uploadUrl, image: imageUrn } = initResponse.data.value;

  // Step 2: Upload the image binary
  const imageBuffer = Buffer.isBuffer(imageSource)
    ? imageSource
    : fs.readFileSync(imageSource);
  await axios.put(uploadUrl, imageBuffer, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    maxBodyLength: Infinity,
  });

  return imageUrn;
}

export async function createImagePost(
  accessToken: string,
  personUrn: string,
  text: string,
  imageSource: string | Buffer
): Promise<string> {
  // Upload image first (accepts file path or Buffer)
  const imageUrn = await uploadImage(accessToken, personUrn, imageSource);
  const cleanText = sanitizeForLinkedIn(text);

  const response = await axios.post(
    `${LINKEDIN_API}/rest/posts`,
    {
      author: personUrn,
      commentary: cleanText,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        media: {
          id: imageUrn,
        },
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": "202602",
      },
    }
  );

  const postId = response.headers["x-restli-id"] || response.data?.id || "unknown";
  return postId;
}
