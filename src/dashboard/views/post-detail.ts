import { layout } from "./layout";

interface Post {
  id: number;
  content: string;
  status: string;
  has_image: boolean;
  linkedin_post_id: string | null;
  created_at: string;
  posted_at: string | null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusBadge(status: string): string {
  const classes: Record<string, string> = {
    published: "badge-published",
    draft: "badge-draft",
    approved: "badge-approved",
    rejected: "badge-rejected",
  };
  const cls = classes[status] || "badge-draft";
  return `<span class="badge ${cls}">${status}</span>`;
}

export function postDetailPage(post: Post, meta?: { draftCount?: number }): string {
  const content = `
    <div class="post-detail-breadcrumb">
      <a href="/posts" class="breadcrumb-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Posts
      </a>
    </div>

    <div class="post-detail">
      <div class="post-detail-header">
        <div class="post-meta">
          ${statusBadge(post.status)}
          <span class="post-date">Created: ${new Date(post.created_at).toLocaleString()}</span>
          ${post.posted_at ? `<span class="post-date">Posted: ${new Date(post.posted_at).toLocaleString()}</span>` : ""}
          ${post.linkedin_post_id ? `<span class="post-linkedin-id">${escapeHtml(post.linkedin_post_id)}</span>` : ""}
        </div>
      </div>

      <div class="linkedin-preview">
        <div class="linkedin-preview-header">
          <div class="linkedin-avatar">LI</div>
          <div class="linkedin-author-info">
            <div class="linkedin-author">Your LinkedIn Profile</div>
            <div class="linkedin-timestamp">${post.posted_at ? new Date(post.posted_at).toLocaleDateString() : "Not yet posted"}</div>
          </div>
        </div>
        <div class="post-text">${escapeHtml(post.content).replace(/\n/g, "<br>")}</div>
        ${post.has_image ? `
        <div class="post-image-full" style="margin-top: 18px">
          <img src="/api/posts/${post.id}/image" alt="Post image" class="detail-image">
        </div>` : ""}
      </div>
    </div>
  `;

  return layout(`Post #${post.id}`, content, "posts", meta);
}
