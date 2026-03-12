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

// GET / - Overview page
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [overview, tip, draftCount] = await Promise.all([
      getPostCounts(),
      getLatestTip(),
      getDraftCount(),
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
    const [{ posts, total }, draftCount] = await Promise.all([
      getAllPosts(page, limit, status),
      getDraftCount(),
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
      getDraftCount(),
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

// GET /drafts - Draft approval page
router.get("/drafts", async (_req: Request, res: Response) => {
  try {
    const drafts = await getDraftPosts();
    const html = draftsPage(drafts, { draftCount: drafts.length });
    res.send(html);
  } catch (err) {
    console.error("Error rendering drafts:", err);
    res.status(500).send("Internal Server Error");
  }
});

export default router;
