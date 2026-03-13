import { Router, Request, Response } from "express";
import {
  getAllPosts,
  getPostById,
  getDraftPosts,
  getDraftCount,
  getPostCounts,
  getLatestTip,
} from "../../storage/db";
import { homePage } from "../views/home";
import { postsPage } from "../views/posts";
import { draftsPage } from "../views/drafts";
import { postDetailPage } from "../views/post-detail";

const router = Router();

function paramStr(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || "";
  return val || "";
}

// Simple in-memory cache (60s TTL) to avoid hammering Neon on every page load
const cache = new Map<string, { data: any; expires: number }>();
function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expires) return Promise.resolve(entry.data);
  return fn().then((data) => {
    cache.set(key, { data, expires: Date.now() + ttlMs });
    return data;
  });
}

// GET / - Overview page
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [overview, tip, draftCount] = await Promise.all([
      cached("postCounts", 60_000, getPostCounts),
      cached("latestTip", 300_000, getLatestTip),
      cached("draftCount", 30_000, getDraftCount),
    ]);
    const html = homePage(overview, tip, { draftCount });
    res.send(html);
  } catch (err) {
    console.error("Error rendering overview:", err);
    res.status(500).send("Internal Server Error");
  }
});

// GET /posts - Post history
router.get("/posts", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const status = req.query.status as string | undefined;
    const cacheKey = `posts_${page}_${limit}_${status || "all"}`;
    const [{ posts, total }, draftCount] = await Promise.all([
      cached(cacheKey, 30_000, () => getAllPosts(page, limit, status)),
      cached("draftCount", 30_000, getDraftCount),
    ]);
    const html = postsPage(posts, page, total, limit, status, { draftCount });
    res.send(html);
  } catch (err) {
    console.error("Error rendering posts:", err);
    res.status(500).send("Internal Server Error");
  }
});

// GET /posts/:id - Post detail
router.get("/posts/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(paramStr(req.params.id));
    if (isNaN(id)) {
      res.status(400).send("Invalid post ID");
      return;
    }
    const [post, draftCount] = await Promise.all([
      getPostById(id),
      cached("draftCount", 30_000, getDraftCount),
    ]);
    if (!post) {
      res.status(404).send("Post not found");
      return;
    }
    const html = postDetailPage(post, { draftCount });
    res.send(html);
  } catch (err) {
    console.error("Error rendering post detail:", err);
    res.status(500).send("Internal Server Error");
  }
});

// GET /drafts - Draft approval page (no cache - always fresh for approvals)
router.get("/drafts", async (_req: Request, res: Response) => {
  try {
    const drafts = await getDraftPosts();
    // Invalidate draft count cache when viewing drafts
    cache.delete("draftCount");
    const html = draftsPage(drafts, { draftCount: drafts.length });
    res.send(html);
  } catch (err) {
    console.error("Error rendering drafts:", err);
    res.status(500).send("Internal Server Error");
  }
});

export default router;
