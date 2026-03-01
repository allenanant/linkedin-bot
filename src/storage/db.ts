import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let db: Database.Database;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = path.resolve(__dirname, "../../data/posts.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  initTables();
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      image_path TEXT,
      image_prompt TEXT,
      linkedin_post_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      research_data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      posted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES posts(id)
    );

    CREATE TABLE IF NOT EXISTS research_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function savePost(post: {
  content: string;
  imagePath?: string;
  imagePrompt?: string;
  researchData?: string;
  status?: string;
}): number {
  const stmt = getDb().prepare(`
    INSERT INTO posts (content, image_path, image_prompt, research_data, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    post.content,
    post.imagePath || null,
    post.imagePrompt || null,
    post.researchData || null,
    post.status || "draft"
  );
  return result.lastInsertRowid as number;
}

export function markPostPublished(postId: number, linkedinPostId: string) {
  getDb()
    .prepare(`UPDATE posts SET status = 'published', linkedin_post_id = ?, posted_at = datetime('now') WHERE id = ?`)
    .run(linkedinPostId, postId);
}

export function getRecentPosts(limit = 10): any[] {
  return getDb().prepare(`SELECT * FROM posts ORDER BY created_at DESC LIMIT ?`).all(limit);
}

export function getTodayPostCount(): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) as count FROM posts WHERE date(created_at) = date('now') AND status = 'published'`)
    .get() as any;
  return row.count;
}

export function saveAnalytics(postId: number, metrics: { likes: number; comments: number; shares: number; impressions: number }) {
  getDb()
    .prepare(`INSERT INTO analytics (post_id, likes, comments, shares, impressions) VALUES (?, ?, ?, ?, ?)`)
    .run(postId, metrics.likes, metrics.comments, metrics.shares, metrics.impressions);
}

export function saveResearchCache(type: string, data: any) {
  getDb().prepare(`INSERT INTO research_cache (type, data) VALUES (?, ?)`).run(type, JSON.stringify(data));
}

export function getPostsWithLinkedinId(): any[] {
  return getDb()
    .prepare(`SELECT * FROM posts WHERE linkedin_post_id IS NOT NULL ORDER BY posted_at DESC LIMIT 20`)
    .all();
}
