import axios from "axios";

export interface SocialSearchResult {
  title: string;
  snippet: string;
  link: string;
  source: "twitter" | "quora";
}

export async function fetchSocialSearchResults(
  apiKey: string,
  searchEngineId: string,
  keywords: string[],
  resultsPerKeyword: number = 3
): Promise<SocialSearchResult[]> {
  if (!apiKey || !searchEngineId) {
    return [];
  }

  const allResults: SocialSearchResult[] = [];
  const keywordsToSearch = keywords.slice(0, 3);

  for (const keyword of keywordsToSearch) {
    for (const site of ["x.com", "quora.com"] as const) {
      try {
        const response = await axios.get(
          "https://www.googleapis.com/customsearch/v1",
          {
            params: {
              key: apiKey,
              cx: searchEngineId,
              q: `${keyword} site:${site}`,
              num: resultsPerKeyword,
              dateRestrict: "m1",
            },
            timeout: 10000,
          }
        );

        for (const item of response.data?.items || []) {
          allResults.push({
            title: item.title || "",
            snippet: (item.snippet || "").slice(0, 300),
            link: item.link || "",
            source: site === "x.com" ? "twitter" : "quora",
          });
        }
      } catch (err: any) {
        console.warn(`[SocialSearch] Failed for "${keyword}" on ${site}: ${err.message}`);
      }
    }
  }

  return allResults;
}
