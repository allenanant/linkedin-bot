import axios from "axios";

const LINKEDIN_API = "https://api.linkedin.com";

interface PostMetrics {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
}

export async function fetchPostAnalytics(
  accessToken: string,
  postUrn: string
): Promise<PostMetrics> {
  try {
    // Use the socialMetrics endpoint for individual post stats
    const encodedUrn = encodeURIComponent(postUrn);
    const response = await axios.get(
      `${LINKEDIN_API}/rest/socialMetrics/${encodedUrn}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "LinkedIn-Version": "202602",
        },
      }
    );

    const data = response.data;
    return {
      likes: data.likeCount || 0,
      comments: data.commentCount || 0,
      shares: data.shareCount || 0,
      impressions: data.impressionCount || 0,
    };
  } catch (error: any) {
    // Social metrics endpoint might not be available for all apps
    // Fall back to zeros if we can't fetch
    console.warn(`Could not fetch analytics for ${postUrn}: ${error.message}`);
    return { likes: 0, comments: 0, shares: 0, impressions: 0 };
  }
}

// TODO: Wire up once getPostsWithLinkedinId and saveAnalytics are added to db.ts
export async function updateAllAnalytics(_accessToken: string) {
  console.warn("Analytics collection not yet wired up (missing db functions).");
}
