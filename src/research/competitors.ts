import axios from "axios";

export interface CompetitorMention {
  title: string;
  description: string;
  source: string;
  url: string;
}

// LinkedIn API does not allow scraping competitor posts.
// Instead, we monitor competitor company mentions via NewsAPI.
const DEFAULT_COMPETITORS = [
  "OpenAI",
  "Google AI",
  "Microsoft AI",
  "HubSpot",
  "Salesforce",
  "Meta Ads",
];

export async function fetchCompetitorMentions(
  apiKey: string,
  competitors?: string[],
  pageSize = 10
): Promise<CompetitorMention[]> {
  const companies = competitors || DEFAULT_COMPETITORS;
  const query = companies.map((c) => `"${c}"`).join(" OR ");

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
    console.warn(`Competitor monitoring error: ${err.message}`);
    return [];
  }
}
