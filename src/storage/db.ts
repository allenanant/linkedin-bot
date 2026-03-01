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
      linkedin_post_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      research_data JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      posted_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS analytics (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id),
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
}

// ─── Existing functions (migrated from SQLite to async PG) ───

export async function savePost(post: {
  content: string;
  imagePath?: string;
  imageData?: Buffer;
  imageMime?: string;
  imagePrompt?: string;
  researchData?: string;
  status?: string;
}): Promise<number> {
  const result = await pool.query(
    `INSERT INTO posts (content, image_path, image_data, image_mime, image_prompt, research_data, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      post.content,
      post.imagePath || null,
      post.imageData || null,
      post.imageMime || "image/png",
      post.imagePrompt || null,
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
    `SELECT * FROM posts ORDER BY created_at DESC LIMIT $1`,
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

export async function saveAnalytics(
  postId: number,
  metrics: { likes: number; comments: number; shares: number; impressions: number }
) {
  await pool.query(
    `INSERT INTO analytics (post_id, likes, comments, shares, impressions) VALUES ($1, $2, $3, $4, $5)`,
    [postId, metrics.likes, metrics.comments, metrics.shares, metrics.impressions]
  );
}

export async function saveResearchCache(type: string, data: any) {
  await pool.query(
    `INSERT INTO research_cache (type, data) VALUES ($1, $2)`,
    [type, JSON.stringify(data)]
  );
}

export async function getPostsWithLinkedinId(): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM posts WHERE linkedin_post_id IS NOT NULL ORDER BY posted_at DESC LIMIT 20`
  );
  return result.rows;
}

// ─── New functions for dashboard ───

export async function getAllPosts(page = 1, limit = 20, status?: string): Promise<{ posts: any[]; total: number }> {
  const offset = (page - 1) * limit;
  let query = `SELECT p.*,
    (SELECT likes FROM analytics WHERE post_id = p.id ORDER BY fetched_at DESC LIMIT 1) as latest_likes,
    (SELECT comments FROM analytics WHERE post_id = p.id ORDER BY fetched_at DESC LIMIT 1) as latest_comments,
    (SELECT shares FROM analytics WHERE post_id = p.id ORDER BY fetched_at DESC LIMIT 1) as latest_shares,
    (SELECT impressions FROM analytics WHERE post_id = p.id ORDER BY fetched_at DESC LIMIT 1) as latest_impressions
    FROM posts p`;
  let countQuery = `SELECT COUNT(*) as count FROM posts`;
  const params: any[] = [];
  const countParams: any[] = [];

  if (status) {
    query += ` WHERE p.status = $1`;
    countQuery += ` WHERE status = $1`;
    params.push(status);
    countParams.push(status);
  }

  query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const [postsResult, countResult] = await Promise.all([
    pool.query(query, params),
    pool.query(countQuery, countParams),
  ]);

  return { posts: postsResult.rows, total: parseInt(countResult.rows[0].count, 10) };
}

export async function getPostById(id: number): Promise<any> {
  const result = await pool.query(`SELECT * FROM posts WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function getPostImage(id: number): Promise<{ data: Buffer; mime: string } | null> {
  const result = await pool.query(`SELECT image_data, image_mime FROM posts WHERE id = $1`, [id]);
  if (!result.rows[0]?.image_data) return null;
  return { data: result.rows[0].image_data, mime: result.rows[0].image_mime };
}

export async function getDraftPosts(): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM posts WHERE status = 'draft' ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function getApprovedPosts(): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM posts WHERE status = 'approved' ORDER BY created_at ASC`
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

export async function getAnalyticsForPost(postId: number): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM analytics WHERE post_id = $1 ORDER BY fetched_at ASC`,
    [postId]
  );
  return result.rows;
}

export async function getAggregateAnalytics(days?: number): Promise<{
  postCount: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalImpressions: number;
  imagePostCount: number;
  textPostCount: number;
}> {
  const dateFilter = days && days > 0
    ? `AND p.posted_at >= NOW() - INTERVAL '${days} days'`
    : "";

  const result = await pool.query(`
    SELECT
      COUNT(DISTINCT p.id) as post_count,
      COALESCE(SUM(a.likes), 0) as total_likes,
      COALESCE(SUM(a.comments), 0) as total_comments,
      COALESCE(SUM(a.shares), 0) as total_shares,
      COALESCE(SUM(a.impressions), 0) as total_impressions,
      COUNT(DISTINCT CASE WHEN p.image_data IS NOT NULL THEN p.id END) as image_post_count,
      COUNT(DISTINCT CASE WHEN p.image_data IS NULL THEN p.id END) as text_post_count
    FROM posts p
    LEFT JOIN LATERAL (
      SELECT * FROM analytics WHERE post_id = p.id ORDER BY fetched_at DESC LIMIT 1
    ) a ON true
    WHERE p.status = 'published' ${dateFilter}
  `);
  const r = result.rows[0];
  return {
    postCount: parseInt(r.post_count, 10),
    totalLikes: parseInt(r.total_likes, 10),
    totalComments: parseInt(r.total_comments, 10),
    totalShares: parseInt(r.total_shares, 10),
    totalImpressions: parseInt(r.total_impressions, 10),
    imagePostCount: parseInt(r.image_post_count, 10),
    textPostCount: parseInt(r.text_post_count, 10),
  };
}

export async function getLastAnalyticsUpdate(): Promise<string | null> {
  const result = await pool.query(
    `SELECT fetched_at FROM analytics ORDER BY fetched_at DESC LIMIT 1`
  );
  return result.rows[0]?.fetched_at || null;
}

export async function getWeeklyComparison(): Promise<{
  likesChange: number;
  commentsChange: number;
  sharesChange: number;
  impressionsChange: number;
}> {
  const thisWeek = await getAggregateAnalytics(7);
  const lastTwoWeeks = await getAggregateAnalytics(14);

  const lastWeek = {
    totalLikes: lastTwoWeeks.totalLikes - thisWeek.totalLikes,
    totalComments: lastTwoWeeks.totalComments - thisWeek.totalComments,
    totalShares: lastTwoWeeks.totalShares - thisWeek.totalShares,
    totalImpressions: lastTwoWeeks.totalImpressions - thisWeek.totalImpressions,
  };

  const pctChange = (current: number, previous: number) =>
    previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100);

  return {
    likesChange: pctChange(thisWeek.totalLikes, lastWeek.totalLikes),
    commentsChange: pctChange(thisWeek.totalComments, lastWeek.totalComments),
    sharesChange: pctChange(thisWeek.totalShares, lastWeek.totalShares),
    impressionsChange: pctChange(thisWeek.totalImpressions, lastWeek.totalImpressions),
  };
}

export async function getTimelineData(days = 30): Promise<any[]> {
  const result = await pool.query(`
    SELECT
      DATE(p.posted_at) as date,
      COUNT(DISTINCT p.id) as posts,
      COALESCE(SUM(a.likes), 0) as likes,
      COALESCE(SUM(a.comments), 0) as comments,
      COALESCE(SUM(a.shares), 0) as shares,
      COALESCE(SUM(a.impressions), 0) as impressions
    FROM posts p
    LEFT JOIN LATERAL (
      SELECT * FROM analytics WHERE post_id = p.id ORDER BY fetched_at DESC LIMIT 1
    ) a ON true
    WHERE p.status = 'published' AND p.posted_at >= NOW() - INTERVAL '${days} days'
    GROUP BY DATE(p.posted_at)
    ORDER BY date ASC
  `);
  return result.rows;
}

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
