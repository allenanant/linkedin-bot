import { Pool } from "pg";
import { config } from "../config";

let pool: Pool;

export async function initDb(): Promise<void> {
  if (pool) return;

  pool = new Pool({
    connectionString: config.database.url,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      image_path TEXT,
      image_data BYTEA,
      image_mime TEXT DEFAULT 'image/png',
      image_prompt TEXT,
      pdf_data BYTEA,
      post_type TEXT NOT NULL DEFAULT 'text',
      linkedin_post_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      research_data JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      posted_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS research_cache (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      data JSONB NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS daily_tips (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      analytics_snapshot JSONB,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Add columns if they don't exist (for existing databases)
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS pdf_data BYTEA;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'text';
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$;
  `);
}

// ─── Post functions ───

export async function savePost(post: {
  content: string;
  imagePath?: string;
  imageData?: Buffer;
  imageMime?: string;
  imagePrompt?: string;
  pdfData?: Buffer;
  postType?: string;
  researchData?: string;
  status?: string;
}): Promise<number> {
  const result = await pool.query(
    `INSERT INTO posts (content, image_path, image_data, image_mime, image_prompt, pdf_data, post_type, research_data, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      post.content,
      post.imagePath || null,
      post.imageData || null,
      post.imageMime || "image/png",
      post.imagePrompt || null,
      post.pdfData || null,
      post.postType || "text",
      post.researchData || null,
      post.status || "draft",
    ]
  );
  return result.rows[0].id;
}

export async function markPostPublished(postId: number, linkedinPostId: string) {
  await pool.query(
    `UPDATE posts SET status = 'published', linkedin_post_id = $1, posted_at = NOW() WHERE id = $2`,
    [linkedinPostId, postId]
  );
}

export async function getRecentPosts(limit = 10): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, content, status, created_at, posted_at FROM posts ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function getTodayPostCount(): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM posts WHERE DATE(created_at) = CURRENT_DATE AND status = 'published'`
  );
  return parseInt(result.rows[0].count, 10);
}

export async function saveResearchCache(type: string, data: any) {
  await pool.query(
    `INSERT INTO research_cache (type, data) VALUES ($1, $2)`,
    [type, JSON.stringify(data)]
  );
}

// ─── Dashboard functions ───

export async function getAllPosts(page = 1, limit = 20, status?: string): Promise<{ posts: any[]; total: number }> {
  const offset = (page - 1) * limit;
  let query = `SELECT id, content, image_path, image_prompt, linkedin_post_id, status, post_type, research_data, created_at, posted_at, (image_data IS NOT NULL) as has_image, (pdf_data IS NOT NULL) as has_pdf FROM posts`;
  let countQuery = `SELECT COUNT(*) as count FROM posts`;
  const params: any[] = [];
  const countParams: any[] = [];

  if (status) {
    query += ` WHERE status = $1`;
    countQuery += ` WHERE status = $1`;
    params.push(status);
    countParams.push(status);
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const [postsResult, countResult] = await Promise.all([
    pool.query(query, params),
    pool.query(countQuery, countParams),
  ]);

  return { posts: postsResult.rows, total: parseInt(countResult.rows[0].count, 10) };
}

export async function getPostById(id: number): Promise<any> {
  const result = await pool.query(
    `SELECT id, content, image_path, image_prompt, linkedin_post_id, status, post_type, research_data, created_at, posted_at, (image_data IS NOT NULL) as has_image, (pdf_data IS NOT NULL) as has_pdf FROM posts WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getPostImage(id: number): Promise<{ data: Buffer; mime: string } | null> {
  const result = await pool.query(`SELECT image_data, image_mime FROM posts WHERE id = $1`, [id]);
  if (!result.rows[0]?.image_data) return null;
  return { data: result.rows[0].image_data, mime: result.rows[0].image_mime };
}

export async function getPostPdf(id: number): Promise<Buffer | null> {
  const result = await pool.query(`SELECT pdf_data FROM posts WHERE id = $1`, [id]);
  return result.rows[0]?.pdf_data || null;
}

export async function getDraftPosts(): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, content, post_type, created_at, (image_data IS NOT NULL) as has_image, (pdf_data IS NOT NULL) as has_pdf FROM posts WHERE status = 'draft' ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function getDraftCount(): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM posts WHERE status = 'draft'`
  );
  return parseInt(result.rows[0].count, 10);
}

export async function getApprovedPosts(): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, content, image_path, image_prompt, post_type, status, created_at, (image_data IS NOT NULL) as has_image, (pdf_data IS NOT NULL) as has_pdf FROM posts WHERE status = 'approved' ORDER BY created_at ASC`
  );
  return result.rows;
}

export async function approvePost(id: number) {
  await pool.query(`UPDATE posts SET status = 'approved' WHERE id = $1 AND status = 'draft'`, [id]);
}

export async function updatePostContent(id: number, content: string) {
  await pool.query(`UPDATE posts SET content = $1 WHERE id = $2 AND status = 'draft'`, [content, id]);
}

export async function rejectPost(id: number) {
  await pool.query(`UPDATE posts SET status = 'rejected' WHERE id = $1 AND status = 'draft'`, [id]);
}

// ─── Post counts for overview ───

export async function getPostCounts(): Promise<{
  postCount: number;
  imagePostCount: number;
  textPostCount: number;
}> {
  const result = await pool.query(`
    SELECT
      COUNT(*) as post_count,
      COUNT(CASE WHEN image_data IS NOT NULL THEN 1 END) as image_post_count,
      COUNT(CASE WHEN image_data IS NULL THEN 1 END) as text_post_count
    FROM posts
    WHERE status = 'published'
  `);
  const r = result.rows[0];
  return {
    postCount: parseInt(r.post_count, 10),
    imagePostCount: parseInt(r.image_post_count, 10),
    textPostCount: parseInt(r.text_post_count, 10),
  };
}

// ─── Tips ───

export async function getLatestTip(): Promise<any | null> {
  const result = await pool.query(
    `SELECT * FROM daily_tips ORDER BY generated_at DESC LIMIT 1`
  );
  return result.rows[0] || null;
}

export async function saveDailyTip(content: string, snapshot: any) {
  await pool.query(
    `INSERT INTO daily_tips (content, analytics_snapshot) VALUES ($1, $2)`,
    [content, JSON.stringify(snapshot)]
  );
}
