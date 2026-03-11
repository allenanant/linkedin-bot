import axios from "axios";
import { fetchCompetitorLinkedInPosts, type LinkedInPostResult } from "./linkedin-posts";

export interface CompetitorMention {
  title: string;
  description: string;
  source: string;
  url: string;
}

// AI marketing news sources (kept for topic discovery)
const NEWS_TOPICS = [
  "AI marketing tools",
  "AI advertising",
  "marketing automation AI",
  "AI growth hacking",
  "Meta ads AI",
  "Google ads AI",
];

// LinkedIn creators Allen competes with for attention
const LINKEDIN_COMPETITORS = [
  "Ruben Hassid",
  "Ross Simmonds",
  "Jasmin Alic",
  "Kevin Indig",
  "Amanda Natividad",
  "Lara Acosta",
  "Justin Welsh",
  "Alex Hormozi",
  "Neal O'Grady",
  "Codie Sanchez",
];

/**
 * Fetches AI marketing industry news (for topic discovery).
 * Searches for AI marketing news, not company mentions.
 */
export async function fetchCompetitorMentions(
  apiKey: string,
  competitors?: string[],
  pageSize = 10
): Promise<CompetitorMention[]> {
  const query = NEWS_TOPICS.slice(0, 4).map((t) => `"${t}"`).join(" OR ");

  try {
    const response = await axios.get("https://newsapi.org/v2/everything", {
      params: {
        q: query,
        sortBy: "publishedAt",
        language: "en",
        pageSize,
        apiKey,
      },
    });

    return (response.data.articles || []).map((a: any) => ({
      title: a.title || "",
      description: a.description || "",
      source: a.source?.name || "",
      url: a.url || "",
    }));
  } catch (err: any) {
    console.warn(`News fetch error: ${err.message}`);
    return [];
  }
}

/**
 * Fetches actual LinkedIn posts from competitor creators.
 * Uses Google Custom Search to find their recent posts.
 */
export async function fetchCompetitorPosts(
  googleApiKey: string,
  googleSearchEngineId: string
): Promise<LinkedInPostResult[]> {
  return fetchCompetitorLinkedInPosts(
    googleApiKey,
    googleSearchEngineId,
    LINKEDIN_COMPETITORS,
    2
  );
}
