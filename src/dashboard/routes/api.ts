import { Router, Request, Response } from "express";
import {
  getAllPosts,
  getPostById,
  getPostImage,
  getDraftPosts,
  approvePost,
  updatePostContent,
  rejectPost,
  getAggregateAnalytics,
  getWeeklyComparison,
  getTimelineData,
  getAnalyticsForPost,
  getLatestTip,
  markPostPublished,
  getLastAnalyticsUpdate,
} from "../../storage/db";
import { createTextPost, createImagePost } from "../../linkedin/post";
import { updateAllAnalytics } from "../../linkedin/analytics";
import { config } from "../../config";
import { notifyPostPublished } from "../../notifications/slack";

const router = Router();

function paramStr(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || "";
  return val || "";
}

// GET /api/posts?page=1&limit=20&status=published
router.get("/api/posts", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;
    const result = await getAllPosts(page, limit, status);
    res.json(result);
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// GET /api/posts/:id
router.get("/api/posts/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(paramStr(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid post ID" });
      return;
    }
    const post = await getPostById(id);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const analytics = await getAnalyticsForPost(id);
    res.json({ post, analytics });
  } catch (err) {
    console.error("Error fetching post:", err);
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

// GET /api/posts/:id/image
router.get("/api/posts/:id/image", async (req: Request, res: Response) => {
  try {
    const id = parseInt(paramStr(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid post ID" });
      return;
    }
    const image = await getPostImage(id);
    if (!image) {
      res.status(404).json({ error: "No image found" });
      return;
    }
    res.set("Content-Type", image.mime);
    res.set("Cache-Control", "public, max-age=86400");
    res.send(image.data);
  } catch (err) {
    console.error("Error fetching image:", err);
    res.status(500).json({ error: "Failed to fetch image" });
  }
});

// GET /api/drafts
router.get("/api/drafts", async (_req: Request, res: Response) => {
  try {
    const drafts = await getDraftPosts();
    res.json(drafts);
  } catch (err) {
    console.error("Error fetching drafts:", err);
    res.status(500).json({ error: "Failed to fetch drafts" });
  }
});

// POST /api/drafts/:id/approve?immediate=true
router.post("/api/drafts/:id/approve", async (req: Request, res: Response) => {
  try {
    const id = parseInt(paramStr(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid draft ID" });
      return;
    }

    await approvePost(id);

    const immediate = req.query.immediate === "true";
    if (immediate) {
      const post = await getPostById(id);
      if (!post) {
        res.status(404).json({ error: "Post not found after approval" });
        return;
      }

      let linkedinPostId: string;
      // Check for image data in DB first, then fall back to file path
      const imageRecord = await getPostImage(id);
      if (imageRecord && imageRecord.data) {
        linkedinPostId = await createImagePost(
          config.linkedin.accessToken,
          config.linkedin.personUrn,
          post.content,
          imageRecord.data
        );
      } else if (post.image_path) {
        linkedinPostId = await createImagePost(
          config.linkedin.accessToken,
          config.linkedin.personUrn,
          post.content,
          post.image_path
        );
      } else {
        linkedinPostId = await createTextPost(
          config.linkedin.accessToken,
          config.linkedin.personUrn,
          post.content
        );
      }

      await markPostPublished(id, linkedinPostId);
      await notifyPostPublished(id, linkedinPostId);
      res.json({ success: true, published: true, linkedinPostId });
      return;
    }

    res.json({ success: true, published: false });
  } catch (err) {
    console.error("Error approving draft:", err);
    res.status(500).json({ error: "Failed to approve draft" });
  }
});

// POST /api/drafts/:id/reject
router.post("/api/drafts/:id/reject", async (req: Request, res: Response) => {
  try {
    const id = parseInt(paramStr(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid draft ID" });
      return;
    }
    await rejectPost(id);
    res.json({ success: true });
  } catch (err) {
    console.error("Error rejecting draft:", err);
    res.status(500).json({ error: "Failed to reject draft" });
  }
});

// PUT /api/drafts/:id
router.put("/api/drafts/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(paramStr(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid draft ID" });
      return;
    }
    const { content } = req.body;
    if (!content || typeof content !== "string") {
      res.status(400).json({ error: "Content is required" });
      return;
    }
    await updatePostContent(id, content);
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating draft:", err);
    res.status(500).json({ error: "Failed to update draft" });
  }
});

// GET /api/analytics/overview
router.get("/api/analytics/overview", async (_req: Request, res: Response) => {
  try {
    const [overview, changes] = await Promise.all([
      getAggregateAnalytics(7),
      getWeeklyComparison(),
    ]);
    res.json({ overview, changes });
  } catch (err) {
    console.error("Error fetching analytics:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// GET /api/analytics/timeline?days=30
router.get("/api/analytics/timeline", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const timeline = await getTimelineData(days);
    res.json(timeline);
  } catch (err) {
    console.error("Error fetching timeline:", err);
    res.status(500).json({ error: "Failed to fetch timeline" });
  }
});

// GET /api/tip
router.get("/api/tip", async (_req: Request, res: Response) => {
  try {
    const tip = await getLatestTip();
    res.json(tip);
  } catch (err) {
    console.error("Error fetching tip:", err);
    res.status(500).json({ error: "Failed to fetch tip" });
  }
});

// POST /api/analytics/refresh — manually trigger analytics fetch from LinkedIn
router.post("/api/analytics/refresh", async (_req: Request, res: Response) => {
  try {
    await updateAllAnalytics(config.linkedin.accessToken);
    const lastUpdate = await getLastAnalyticsUpdate();
    res.json({ success: true, lastUpdate });
  } catch (err) {
    console.error("Error refreshing analytics:", err);
    res.status(500).json({ error: "Failed to refresh analytics" });
  }
});

export default router;
