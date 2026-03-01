import { Router, Request, Response } from "express";
import {
  getAllPosts,
  getPostById,
  getDraftPosts,
  getAggregateAnalytics,
  getWeeklyComparison,
  getTimelineData,
  getAnalyticsForPost,
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

// GET / - Overview page
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [overview, changes, timeline, tip] = await Promise.all([
      getAggregateAnalytics(7),
      getWeeklyComparison(),
      getTimelineData(30),
      getLatestTip(),
    ]);
    const html = homePage(overview, changes, timeline, timeline, tip);
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
    const { posts, total } = await getAllPosts(page, limit, status);
    const html = postsPage(posts, page, total, limit);
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
    const post = await getPostById(id);
    if (!post) {
      res.status(404).send("Post not found");
      return;
    }
    const analytics = await getAnalyticsForPost(id);
    const html = postDetailPage(post, analytics);
    res.send(html);
  } catch (err) {
    console.error("Error rendering post detail:", err);
    res.status(500).send("Internal Server Error");
  }
});

// GET /drafts - Draft approval page
router.get("/drafts", async (_req: Request, res: Response) => {
  try {
    const drafts = await getDraftPosts();
    const html = draftsPage(drafts);
    res.send(html);
  } catch (err) {
    console.error("Error rendering drafts:", err);
    res.status(500).send("Internal Server Error");
  }
});

export default router;
