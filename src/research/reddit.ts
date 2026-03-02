import axios from "axios";

export interface RedditPost {
  title: string;
  selftext: string;
  score: number;
  numComments: number;
  subreddit: string;
  permalink: string;
  url: string;
}

const USER_AGENT = "linkedin-bot/1.0 (content research)";

export async function fetchRedditDiscussions(
  subreddits: string[],
  postsPerSubreddit: number = 5
): Promise<RedditPost[]> {
  const allPosts: RedditPost[] = [];

  for (const sub of subreddits) {
    try {
      const response = await axios.get(
        `https://www.reddit.com/r/${sub}/hot.json`,
        {
          params: { limit: postsPerSubreddit },
          headers: { "User-Agent": USER_AGENT },
          timeout: 10000,
        }
      );

      const children = response.data?.data?.children || [];
      for (const child of children) {
        const d = child.data;
        if (d.stickied) continue;

        allPosts.push({
          title: d.title || "",
          selftext: (d.selftext || "").slice(0, 500),
          score: d.score || 0,
          numComments: d.num_comments || 0,
          subreddit: d.subreddit || sub,
          permalink: `https://reddit.com${d.permalink || ""}`,
          url: d.url || "",
        });
      }

      // Stay within Reddit's 10 req/min rate limit
      await new Promise((r) => setTimeout(r, 1200));
    } catch (err: any) {
      console.warn(`[Reddit] Failed to fetch r/${sub}: ${err.message}`);
    }
  }

  // Sort by engagement to surface the most discussed posts
  return allPosts
    .sort((a, b) => b.score * b.numComments - a.score * a.numComments)
    .slice(0, 20);
}
