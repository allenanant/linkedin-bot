import axios from "axios";
import fs from "fs";
import path from "path";

const LINKEDIN_API = "https://api.linkedin.com";

export async function createTextPost(
  accessToken: string,
  personUrn: string,
  text: string
): Promise<string> {
  const response = await axios.post(
    `${LINKEDIN_API}/rest/posts`,
    {
      author: personUrn,
      commentary: text,
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

  const response = await axios.post(
    `${LINKEDIN_API}/rest/posts`,
    {
      author: personUrn,
      commentary: text,
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
