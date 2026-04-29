import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

/**
 * SQLite-backed storage. Replaces Neon Postgres after we hit free-tier compute
 * quota twice. Local file, zero network, zero quota — perfect for a single-host bot.
 *
 * All function signatures match the previous Postgres implementation so callers
 * don't change. Internally:
 *   - $1/$2 placeholders -> ?
 *   - BYTEA -> BLOB (Buffer in/out)
 *   - TIMESTAMPTZ -> TEXT (ISO 8601 via datetime('now'))
 *   - SERIAL -> INTEGER PRIMARY KEY AUTOINCREMENT
 *   - DO $$ ... ALTER TABLE blocks -> wrapped try/catch per column
 */

const DB_PATH = process.env.SQLITE_DB || path.join(process.cwd(), "data", "linkedin-bot.db");

let db: Database.Database;

function ensureDir(filepath: string) {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function tryAlter(sql: string) {
  try {
    db.exec(sql);
  } catch (err: any) {
    // ALTER TABLE ... ADD COLUMN throws if the column already exists. Swallow that case;
    // surface anything else so we don't mask real schema issues.
    if (!/duplicate column|already exists/i.test(err.message)) {
      console.warn(`[DB] ${sql.slice(0, 60)}... -> ${err.message}`);
    }
  }
}

export async function initDb(): Promise<void> {
  if (db) return;

  ensureDir(DB_PATH);
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      image_path TEXT,
      image_data BLOB,
      image_mime TEXT DEFAULT 'image/png',
      image_prompt TEXT,
      pdf_data BLOB,
      post_type TEXT NOT NULL DEFAULT 'text',
      linkedin_post_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      research_data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      posted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS research_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_tips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      analytics_snapshot TEXT,
      generated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Idempotent column adds — survive across deploys
  tryAlter(`ALTER TABLE posts ADD COLUMN video_data BLOB`);
  tryAlter(`ALTER TABLE posts ADD COLUMN video_path TEXT`);
  tryAlter(`ALTER TABLE posts ADD COLUMN slack_channel TEXT`);
  tryAlter(`ALTER TABLE posts ADD COLUMN slack_message_ts TEXT`);
  tryAlter(`ALTER TABLE posts ADD COLUMN cta_keyword TEXT`);
  tryAlter(`ALTER TABLE posts ADD COLUMN lead_magnet_title TEXT`);
  tryAlter(`ALTER TABLE posts ADD COLUMN voice_mode TEXT`);
  tryAlter(`ALTER TABLE posts ADD COLUMN topic TEXT`);
  tryAlter(`ALTER TABLE posts ADD COLUMN lead_magnet_pdf_path TEXT`);
  tryAlter(`ALTER TABLE posts ADD COLUMN linkedin_activity_id TEXT`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS comment_watcher_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      comment_urn TEXT,
      commenter_name TEXT NOT NULL,
      commenter_profile_url TEXT NOT NULL,
      comment_text TEXT NOT NULL,
      keyword_matched INTEGER NOT NULL DEFAULT 0,
      state TEXT NOT NULL DEFAULT 'seen',
      reply_text TEXT,
      reply_posted_at TEXT,
      connection_accepted_at TEXT,
      dm_sent_at TEXT,
      dm_text TEXT,
      expired_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(post_id, commenter_profile_url)
    );
    CREATE INDEX IF NOT EXISTS idx_comment_watcher_state ON comment_watcher_state(state);
    CREATE INDEX IF NOT EXISTS idx_comment_watcher_post ON comment_watcher_state(post_id);
  `);

  console.log(`[DB] SQLite initialized at ${DB_PATH}`);
}

// ─── Helpers for buffer/bool coercion ───
const buf = (v: any): Buffer | null => (v == null ? null : Buffer.isBuffer(v) ? v : Buffer.from(v));
const intBool = (v: any): number => (v ? 1 : 0);
const fromIntBool = (v: any): boolean => v === 1 || v === true;

// ─── Post functions ───

export async function savePost(post: {
  content: string;
  imagePath?: string;
  imageData?: Buffer;
  imageMime?: string;
  imagePrompt?: string;
  pdfData?: Buffer;
  videoData?: Buffer;
  videoPath?: string;
  postType?: string;
  researchData?: string;
  status?: string;
  ctaKeyword?: string;
  leadMagnetTitle?: string;
  voiceMode?: string;
  topic?: string;
}): Promise<number> {
  const stmt = db.prepare(`
    INSERT INTO posts (content, image_path, image_data, image_mime, image_prompt, pdf_data, video_data, video_path, post_type, research_data, status, cta_keyword, lead_magnet_title, voice_mode, topic)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    post.content,
    post.imagePath || null,
    buf(post.imageData),
    post.imageMime || "image/png",
    post.imagePrompt || null,
    buf(post.pdfData),
    buf(post.videoData),
    post.videoPath || null,
    post.postType || "text",
    post.researchData || null,
    post.status || "draft",
    post.ctaKeyword || null,
    post.leadMagnetTitle || null,
    post.voiceMode || null,
    post.topic || null
  );
  return Number(result.lastInsertRowid);
}

export async function markPostPublished(postId: number, linkedinPostId: string, activityId?: string | null) {
  db.prepare(
    `UPDATE posts SET status = 'published', linkedin_post_id = ?, linkedin_activity_id = ?, posted_at = datetime('now') WHERE id = ?`
  ).run(linkedinPostId, activityId || null, postId);
}

export async function setActivityId(postId: number, activityId: string) {
  db.prepare(`UPDATE posts SET linkedin_activity_id = ? WHERE id = ?`).run(activityId, postId);
}

export async function getPostLeadMagnetMeta(postId: number): Promise<{
  ctaKeyword: string | null;
  leadMagnetTitle: string | null;
  voiceMode: string | null;
  topic: string | null;
  content: string;
} | null> {
  const row = db
    .prepare(`SELECT cta_keyword, lead_magnet_title, voice_mode, topic, content FROM posts WHERE id = ?`)
    .get(postId) as any;
  if (!row) return null;
  return {
    ctaKeyword: row.cta_keyword,
    leadMagnetTitle: row.lead_magnet_title,
    voiceMode: row.voice_mode,
    topic: row.topic,
    content: row.content,
  };
}

export async function saveLeadMagnetPath(postId: number, pdfPath: string) {
  db.prepare(`UPDATE posts SET lead_magnet_pdf_path = ? WHERE id = ?`).run(pdfPath, postId);
}

export async function getRecentPosts(limit = 10): Promise<any[]> {
  return db
    .prepare(`SELECT id, content, status, created_at, posted_at FROM posts ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as any[];
}

export async function getTodayPostCount(): Promise<number> {
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM posts WHERE date(created_at) = date('now') AND status = 'published'`
    )
    .get() as any;
  return row?.count || 0;
}

export async function saveResearchCache(type: string, data: any) {
  db.prepare(`INSERT INTO research_cache (type, data) VALUES (?, ?)`).run(type, JSON.stringify(data));
}

// ─── Dashboard functions ───

export async function getAllPosts(
  page = 1,
  limit = 20,
  status?: string
): Promise<{ posts: any[]; total: number }> {
  const offset = (page - 1) * limit;
  let where = "";
  const filters: any[] = [];
  if (status) {
    where = ` WHERE status = ?`;
    filters.push(status);
  }
  const posts = db
    .prepare(
      `SELECT id, content, image_path, image_prompt, linkedin_post_id, status, post_type, created_at, posted_at,
              (image_data IS NOT NULL) as has_image, (pdf_data IS NOT NULL) as has_pdf
       FROM posts${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...filters, limit, offset) as any[];
  const totalRow = db
    .prepare(`SELECT COUNT(*) as count FROM posts${where}`)
    .get(...filters) as any;
  return { posts, total: totalRow?.count || 0 };
}

export async function getPostById(id: number): Promise<any> {
  return (
    db
      .prepare(
        `SELECT id, content, image_path, image_prompt, linkedin_post_id, status, post_type, research_data,
                created_at, posted_at, (image_data IS NOT NULL) as has_image, (pdf_data IS NOT NULL) as has_pdf
         FROM posts WHERE id = ?`
      )
      .get(id) as any
  ) || null;
}

export async function getPostImage(id: number): Promise<{ data: Buffer; mime: string } | null> {
  const row = db.prepare(`SELECT image_data, image_mime FROM posts WHERE id = ?`).get(id) as any;
  if (!row?.image_data) return null;
  return { data: buf(row.image_data)!, mime: row.image_mime };
}

export async function getPostPdf(id: number): Promise<Buffer | null> {
  const row = db.prepare(`SELECT pdf_data FROM posts WHERE id = ?`).get(id) as any;
  return row?.pdf_data ? buf(row.pdf_data) : null;
}

export async function getPostVideo(id: number): Promise<Buffer | null> {
  const row = db.prepare(`SELECT video_data FROM posts WHERE id = ?`).get(id) as any;
  return row?.video_data ? buf(row.video_data) : null;
}

export async function getDraftPosts(): Promise<any[]> {
  return db
    .prepare(
      `SELECT id, content, post_type, created_at,
              (image_data IS NOT NULL) as has_image, (pdf_data IS NOT NULL) as has_pdf
       FROM posts WHERE status = 'draft' ORDER BY created_at DESC`
    )
    .all() as any[];
}

export async function getDraftCount(): Promise<number> {
  const row = db.prepare(`SELECT COUNT(*) as count FROM posts WHERE status = 'draft'`).get() as any;
  return row?.count || 0;
}

export async function getApprovedPosts(): Promise<any[]> {
  return db
    .prepare(
      `SELECT id, content, image_path, image_prompt, post_type, status, created_at,
              (image_data IS NOT NULL) as has_image, (pdf_data IS NOT NULL) as has_pdf
       FROM posts WHERE status = 'approved' ORDER BY created_at ASC`
    )
    .all() as any[];
}

export async function approvePost(id: number) {
  db.prepare(`UPDATE posts SET status = 'approved' WHERE id = ? AND status = 'draft'`).run(id);
}

export async function updatePostContent(id: number, content: string) {
  db.prepare(`UPDATE posts SET content = ? WHERE id = ? AND status = 'draft'`).run(content, id);
}

export async function rejectPost(id: number) {
  db.prepare(`UPDATE posts SET status = 'rejected' WHERE id = ? AND status = 'draft'`).run(id);
}

// ─── Slack message tracking ───

export async function saveSlackMessageRef(postId: number, channel: string, messageTs: string) {
  db.prepare(`UPDATE posts SET slack_channel = ?, slack_message_ts = ? WHERE id = ?`).run(
    channel,
    messageTs,
    postId
  );
}

export async function getSlackMessageRef(
  postId: number
): Promise<{ channel: string; ts: string } | null> {
  const row = db
    .prepare(`SELECT slack_channel, slack_message_ts FROM posts WHERE id = ?`)
    .get(postId) as any;
  if (!row?.slack_channel || !row?.slack_message_ts) return null;
  return { channel: row.slack_channel, ts: row.slack_message_ts };
}

// ─── Post counts ───

export async function getPostCounts(): Promise<{
  postCount: number;
  imagePostCount: number;
  textPostCount: number;
}> {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) as post_count,
         SUM(CASE WHEN image_data IS NOT NULL THEN 1 ELSE 0 END) as image_post_count,
         SUM(CASE WHEN image_data IS NULL THEN 1 ELSE 0 END) as text_post_count
       FROM posts WHERE status = 'published'`
    )
    .get() as any;
  return {
    postCount: row?.post_count || 0,
    imagePostCount: row?.image_post_count || 0,
    textPostCount: row?.text_post_count || 0,
  };
}

// ─── Tips ───

export async function getLatestTip(): Promise<any | null> {
  return (db.prepare(`SELECT * FROM daily_tips ORDER BY generated_at DESC LIMIT 1`).get() as any) || null;
}

export async function saveDailyTip(content: string, snapshot: any) {
  db.prepare(`INSERT INTO daily_tips (content, analytics_snapshot) VALUES (?, ?)`).run(
    content,
    JSON.stringify(snapshot)
  );
}

// ─── Comment watcher state ───

export type CommentWatcherRow = {
  id: number;
  post_id: number;
  comment_urn: string | null;
  commenter_name: string;
  commenter_profile_url: string;
  comment_text: string;
  keyword_matched: boolean;
  state: string;
  reply_text: string | null;
  reply_posted_at: string | null;
  connection_accepted_at: string | null;
  dm_sent_at: string | null;
  dm_text: string | null;
  expired_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type CtaPostRow = {
  id: number;
  content: string;
  topic: string | null;
  cta_keyword: string;
  lead_magnet_title: string | null;
  lead_magnet_pdf_path: string | null;
  linkedin_activity_id: string | null;
  linkedin_post_id: string | null;
  posted_at: string;
};

function rowToCommentWatcher(row: any): CommentWatcherRow {
  return { ...row, keyword_matched: fromIntBool(row.keyword_matched) };
}

export async function getCtaPostsToWatch(daysBack = 30): Promise<CtaPostRow[]> {
  return db
    .prepare(
      `SELECT id, content, topic, cta_keyword, lead_magnet_title, lead_magnet_pdf_path,
              linkedin_activity_id, linkedin_post_id, posted_at
       FROM posts
       WHERE status = 'published'
         AND cta_keyword IS NOT NULL
         AND cta_keyword != ''
         AND cta_keyword != 'NONE'
         AND posted_at > datetime('now', ?)
       ORDER BY posted_at DESC`
    )
    .all(`-${daysBack} days`) as CtaPostRow[];
}

export async function recordSeenComment(args: {
  postId: number;
  commentUrn?: string | null;
  commenterName: string;
  commenterProfileUrl: string;
  commentText: string;
  keywordMatched: boolean;
}): Promise<CommentWatcherRow> {
  const row = db
    .prepare(
      `INSERT INTO comment_watcher_state
         (post_id, comment_urn, commenter_name, commenter_profile_url, comment_text, keyword_matched, state)
       VALUES (?, ?, ?, ?, ?, ?, 'seen')
       ON CONFLICT(post_id, commenter_profile_url) DO UPDATE
         SET comment_text = excluded.comment_text,
             comment_urn = COALESCE(excluded.comment_urn, comment_watcher_state.comment_urn),
             updated_at = datetime('now')
       RETURNING *`
    )
    .get(
      args.postId,
      args.commentUrn || null,
      args.commenterName,
      args.commenterProfileUrl,
      args.commentText,
      intBool(args.keywordMatched)
    ) as any;
  return rowToCommentWatcher(row);
}

export async function getSeenProfileUrlsForPost(postId: number): Promise<Set<string>> {
  const rows = db
    .prepare(`SELECT commenter_profile_url FROM comment_watcher_state WHERE post_id = ?`)
    .all(postId) as any[];
  return new Set(rows.map((r) => r.commenter_profile_url));
}

export async function setCommentState(
  id: number,
  state: string,
  fields: Partial<{
    reply_text: string;
    reply_posted_at: boolean;
    connection_accepted_at: boolean;
    dm_sent_at: boolean;
    dm_text: string;
    expired_at: boolean;
    last_error: string | null;
  }> = {}
) {
  const setParts: string[] = [`state = ?`, `updated_at = datetime('now')`];
  const params: any[] = [state];
  if (fields.reply_text !== undefined) {
    setParts.push(`reply_text = ?`);
    params.push(fields.reply_text);
  }
  if (fields.reply_posted_at) setParts.push(`reply_posted_at = datetime('now')`);
  if (fields.connection_accepted_at) setParts.push(`connection_accepted_at = datetime('now')`);
  if (fields.dm_sent_at) setParts.push(`dm_sent_at = datetime('now')`);
  if (fields.dm_text !== undefined) {
    setParts.push(`dm_text = ?`);
    params.push(fields.dm_text);
  }
  if (fields.expired_at) setParts.push(`expired_at = datetime('now')`);
  if (fields.last_error !== undefined) {
    setParts.push(`last_error = ?`);
    params.push(fields.last_error);
  }
  params.push(id);
  db.prepare(`UPDATE comment_watcher_state SET ${setParts.join(", ")} WHERE id = ?`).run(...params);
}

export async function getSeenComments(): Promise<CommentWatcherRow[]> {
  const rows = db
    .prepare(`SELECT * FROM comment_watcher_state WHERE state = 'seen' ORDER BY created_at ASC`)
    .all() as any[];
  return rows.map(rowToCommentWatcher);
}

export async function getAwaitingConnection(): Promise<CommentWatcherRow[]> {
  const rows = db
    .prepare(
      `SELECT * FROM comment_watcher_state WHERE state = 'awaiting_connection' ORDER BY created_at ASC`
    )
    .all() as any[];
  return rows.map(rowToCommentWatcher);
}

export async function getReadyToDm(): Promise<CommentWatcherRow[]> {
  const rows = db
    .prepare(
      `SELECT * FROM comment_watcher_state WHERE state = 'connected' ORDER BY connection_accepted_at ASC`
    )
    .all() as any[];
  return rows.map(rowToCommentWatcher);
}

export async function expireStaleAwaitingConnection(days = 5): Promise<number> {
  const result = db
    .prepare(
      `UPDATE comment_watcher_state
       SET state = 'expired', expired_at = datetime('now'), updated_at = datetime('now')
       WHERE state = 'awaiting_connection' AND created_at < datetime('now', ?)`
    )
    .run(`-${days} days`);
  return result.changes || 0;
}

export async function findCommentWatcherByProfile(
  postId: number,
  commenterProfileUrl: string
): Promise<CommentWatcherRow | null> {
  const row = db
    .prepare(`SELECT * FROM comment_watcher_state WHERE post_id = ? AND commenter_profile_url = ?`)
    .get(postId, commenterProfileUrl) as any;
  return row ? rowToCommentWatcher(row) : null;
}

export async function findAwaitingByProfileUrls(profileUrls: string[]): Promise<CommentWatcherRow[]> {
  if (!profileUrls.length) return [];
  const placeholders = profileUrls.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT * FROM comment_watcher_state
       WHERE state = 'awaiting_connection' AND commenter_profile_url IN (${placeholders})`
    )
    .all(...profileUrls) as any[];
  return rows.map(rowToCommentWatcher);
}
