import axios from "axios";

export interface YouTubeVideo {
  title: string;
  channelName: string;
  viewCount: number;
  publishedAt: string;
  topComments: string[];
  videoId: string;
}

const API_BASE = "https://www.googleapis.com/youtube/v3";

export async function fetchYouTubeTopics(
  apiKey: string,
  keywords: string[],
  videosPerKeyword: number = 3
): Promise<YouTubeVideo[]> {
  if (!apiKey) {
    console.warn("[YouTube] No API key configured — skipping.");
    return [];
  }

  const allVideos: YouTubeVideo[] = [];
  const keywordsToSearch = keywords.slice(0, 5);

  for (const keyword of keywordsToSearch) {
    try {
      // Step 1: Search for recent videos
      const searchRes = await axios.get(`${API_BASE}/search`, {
        params: {
          part: "snippet",
          q: keyword,
          type: "video",
          order: "relevance",
          publishedAfter: daysAgo(7),
          maxResults: videosPerKeyword,
          key: apiKey,
        },
        timeout: 10000,
      });

      const videoIds = (searchRes.data?.items || [])
        .map((item: any) => item.id?.videoId)
        .filter(Boolean);

      if (videoIds.length === 0) continue;

      // Step 2: Get video stats
      const statsRes = await axios.get(`${API_BASE}/videos`, {
        params: {
          part: "statistics,snippet",
          id: videoIds.join(","),
          key: apiKey,
        },
        timeout: 10000,
      });

      // Step 3: Fetch top comments for each video
      for (const video of statsRes.data?.items || []) {
        let topComments: string[] = [];
        try {
          const commentsRes = await axios.get(`${API_BASE}/commentThreads`, {
            params: {
              part: "snippet",
              videoId: video.id,
              order: "relevance",
              maxResults: 5,
              key: apiKey,
            },
            timeout: 10000,
          });

          topComments = (commentsRes.data?.items || []).map(
            (item: any) =>
              (item.snippet?.topLevelComment?.snippet?.textDisplay || "")
                .replace(/<[^>]*>/g, "")
                .slice(0, 200)
          );
        } catch {
          // Comments may be disabled
        }

        allVideos.push({
          title: video.snippet?.title || "",
          channelName: video.snippet?.channelTitle || "",
          viewCount: parseInt(video.statistics?.viewCount || "0", 10),
          publishedAt: video.snippet?.publishedAt || "",
          topComments,
          videoId: video.id,
        });
      }
    } catch (err: any) {
      console.warn(`[YouTube] Search failed for "${keyword}": ${err.message}`);
    }
  }

  return allVideos.sort((a, b) => b.viewCount - a.viewCount).slice(0, 15);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
