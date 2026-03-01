import axios from "axios";

export interface NewsArticle {
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
}

export async function fetchIndustryNews(
  apiKey: string,
  keywords: string[],
  pageSize = 10
): Promise<NewsArticle[]> {
  const query = keywords.join(" OR ");

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
      publishedAt: a.publishedAt || "",
    }));
  } catch (err: any) {
    console.warn(`NewsAPI error: ${err.message}`);
    return [];
  }
}

export async function fetchTopHeadlines(
  apiKey: string,
  category = "technology",
  pageSize = 5
): Promise<NewsArticle[]> {
  try {
    const response = await axios.get("https://newsapi.org/v2/top-headlines", {
      params: {
        category,
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
      publishedAt: a.publishedAt || "",
    }));
  } catch (err: any) {
    console.warn(`Headlines error: ${err.message}`);
    return [];
  }
}
