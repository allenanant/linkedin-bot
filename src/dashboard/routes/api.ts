import { Router, Request, Response } from "express";
import {
  getAllPosts,
  getPostById,
  getPostImage,
  getDraftPosts,
  approvePost,
  updatePostContent,
  rejectPost,
  getLatestTip,
  markPostPublished,
  savePost,
} from "../../storage/db";
import { createTextPost, createImagePost } from "../../linkedin/post";
import { config } from "../../config";
import { notifyPostPublished, notifyDraftReady } from "../../notifications/slack";
import { runResearch } from "../../pipeline/research";
import { generateLinkedInPost } from "../../content/generator";
import { generateImage } from "../../content/image-generator";
import fs from "fs";

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
    res.json({ post });
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

// POST /api/create/news — generate a news-style draft post on demand
router.post("/api/create/news", async (_req: Request, res: Response) => {
  try {
    console.log("[Dashboard] Creating news post on demand...");
    const research = await runResearch();
    const generated = await generateLinkedInPost(research, true, "news");

    let imagePath: string | null = null;
    if (generated.imageData) {
      imagePath = await generateImage(generated.imageData);
      if (!imagePath) {
        imagePath = await generateImage(generated.imageData); // retry once
      }
    }

    let imageBuffer: Buffer | null = null;
    if (imagePath) {
      imageBuffer = fs.readFileSync(imagePath);
    }

    const postId = await savePost({
      content: generated.content,
      imagePath: imagePath || undefined,
      imagePrompt: generated.imageData ? JSON.stringify(generated.imageData) : undefined,
      researchData: JSON.stringify(research),
      status: "draft",
      imageData: imageBuffer || undefined,
    });

    await notifyDraftReady({
      postId,
      content: generated.content,
      hasImage: !!imagePath,
      topic: generated.topic,
    });

    console.log(`[Dashboard] News post #${postId} created as draft.`);
    res.json({ success: true, postId });
  } catch (err: any) {
    console.error("Error creating news post:", err);
    res.status(500).json({ error: err.message || "Failed to create news post" });
  }
});

// POST /api/create/freebie — generate a freebie-style draft post on demand
router.post("/api/create/freebie", async (_req: Request, res: Response) => {
  try {
    console.log("[Dashboard] Creating freebie post on demand...");
    const research = await runResearch();
    const generated = await generateLinkedInPost(research, true, "freebie");

    let imagePath: string | null = null;
    if (generated.imageData) {
      imagePath = await generateImage(generated.imageData);
      if (!imagePath) {
        imagePath = await generateImage(generated.imageData); // retry once
      }
    }

    let imageBuffer: Buffer | null = null;
    if (imagePath) {
      imageBuffer = fs.readFileSync(imagePath);
    }

    const postId = await savePost({
      content: generated.content,
      imagePath: imagePath || undefined,
      imagePrompt: generated.imageData ? JSON.stringify(generated.imageData) : undefined,
      researchData: JSON.stringify(research),
      status: "draft",
      imageData: imageBuffer || undefined,
    });

    await notifyDraftReady({
      postId,
      content: generated.content,
      hasImage: !!imagePath,
      topic: generated.topic,
    });

    console.log(`[Dashboard] Freebie post #${postId} created as draft.`);
    res.json({ success: true, postId });
  } catch (err: any) {
    console.error("Error creating freebie post:", err);
    res.status(500).json({ error: err.message || "Failed to create freebie post" });
  }
});

export default router;
