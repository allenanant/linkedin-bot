import googleTrends from "google-trends-api";

export interface TrendingTopic {
  keyword: string;
  relatedQueries: string[];
}

export async function fetchTrendingTopics(keywords: string[]): Promise<TrendingTopic[]> {
  const topics: TrendingTopic[] = [];

  for (const keyword of keywords.slice(0, 5)) {
    try {
      const relatedData = await googleTrends.relatedQueries({ keyword, geo: "US" });
      const parsed = JSON.parse(relatedData);
      const topQueries = parsed.default?.rankedList?.[0]?.rankedKeyword || [];
      const risingQueries = parsed.default?.rankedList?.[1]?.rankedKeyword || [];

      const related = [
        ...topQueries.slice(0, 3).map((q: any) => q.query),
        ...risingQueries.slice(0, 3).map((q: any) => q.query),
      ];

      topics.push({ keyword, relatedQueries: related });
    } catch (err: any) {
      console.warn(`Could not fetch trends for "${keyword}": ${err.message}`);
      topics.push({ keyword, relatedQueries: [] });
    }

    // Rate limit: small delay between requests
    await new Promise((r) => setTimeout(r, 1000));
  }

  return topics;
}

export async function fetchDailyTrends(): Promise<string[]> {
  try {
    const data = await googleTrends.dailyTrends({ geo: "US" });
    const parsed = JSON.parse(data);
    const trends = parsed.default?.trendingSearchesDays?.[0]?.trendingSearches || [];
    return trends.slice(0, 10).map((t: any) => t.title?.query || "");
  } catch (err: any) {
    console.warn(`Could not fetch daily trends: ${err.message}`);
    return [];
  }
}
