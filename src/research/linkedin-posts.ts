import axios from "axios";

export interface LinkedInPostResult {
  title: string;
  snippet: string;
  link: string;
  author: string;
}

/**
 * Searches Google for real LinkedIn posts about a topic.
 * Returns actual post snippets from linkedin.com that we can analyze
 * for hooks, structure, and engagement patterns.
 */
export async function fetchLinkedInPosts(
  apiKey: string,
  searchEngineId: string,
  topic: string,
  maxResults: number = 10
): Promise<LinkedInPostResult[]> {
  if (!apiKey || !searchEngineId) {
    console.warn("[LinkedInPosts] No Google Search API key or engine ID configured — skipping.");
    return [];
  }

  const allResults: LinkedInPostResult[] = [];

  // Search for LinkedIn posts and articles about this topic
  const queries = [
    `site:linkedin.com/posts "${topic.split(" ").slice(0, 4).join(" ")}"`,
    `site:linkedin.com/pulse ${topic}`,
    `linkedin "${topic.split(" ").slice(0, 5).join(" ")}" marketing`,
  ];

  for (const query of queries) {
    try {
      const response = await axios.get(
        "https://www.googleapis.com/customsearch/v1",
        {
          params: {
            key: apiKey,
            cx: searchEngineId,
            q: query,
            num: Math.min(maxResults, 10),
            dateRestrict: "m3", // last 3 months
          },
          timeout: 10000,
        }
      );

      for (const item of response.data?.items || []) {
        const title = item.title || "";
        const snippet = (item.snippet || "").slice(0, 500);
        const link = item.link || "";

        // Extract author name from LinkedIn URL or title
        // LinkedIn titles often follow: "Author Name on LinkedIn: post text"
        let author = "Unknown";
        const authorMatch = title.match(/^(.+?)\s+(?:on LinkedIn|posted on)/i);
        if (authorMatch) {
          author = authorMatch[1].trim();
        }

        allResults.push({ title, snippet, link, author });
      }
    } catch (err: any) {
      console.warn(`[LinkedInPosts] Search failed for query: ${err.message}`);
    }
  }

  // Deduplicate by link
  const seen = new Set<string>();
  return allResults.filter((r) => {
    if (seen.has(r.link)) return false;
    seen.add(r.link);
    return true;
  });
}

/**
 * Fetches LinkedIn posts from specific competitor/influencer profiles.
 * Searches Google for recent posts by known LinkedIn creators in marketing/AI.
 */
export async function fetchCompetitorLinkedInPosts(
  apiKey: string,
  searchEngineId: string,
  competitors: string[] = [
    "Ruben Hassid",
    "Ross Simmonds",
    "Jasmin Alic",
    "Kevin Indig",
    "Amanda Natividad",
    "Lara Acosta",
    "Justin Welsh",
    "Alex Hormozi",
  ],
  maxPerCompetitor: number = 3
): Promise<LinkedInPostResult[]> {
  if (!apiKey || !searchEngineId) {
    console.warn("[CompetitorPosts] No Google Search API key or engine ID — skipping.");
    return [];
  }

  const allResults: LinkedInPostResult[] = [];

  for (const name of competitors) {
    try {
      const response = await axios.get(
        "https://www.googleapis.com/customsearch/v1",
        {
          params: {
            key: apiKey,
            cx: searchEngineId,
            q: `site:linkedin.com/posts "${name}"`,
            num: maxPerCompetitor,
            dateRestrict: "m1", // last month
          },
          timeout: 10000,
        }
      );

      for (const item of response.data?.items || []) {
        allResults.push({
          title: item.title || "",
          snippet: (item.snippet || "").slice(0, 500),
          link: item.link || "",
          author: name,
        });
      }
    } catch (err: any) {
      console.warn(`[CompetitorPosts] Failed for "${name}": ${err.message}`);
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 200));
  }

  return allResults;
}
