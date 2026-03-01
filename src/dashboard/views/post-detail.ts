import { layout } from "./layout";

interface Post {
  id: number;
  content: string;
  status: string;
  image_data: Buffer | null;
  linkedin_post_id: string | null;
  created_at: string;
  posted_at: string | null;
}

interface AnalyticsSnapshot {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  fetched_at: string;
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

export function postDetailPage(post: Post, analytics: AnalyticsSnapshot[], meta?: { draftCount?: number }): string {
  const latestAnalytics = analytics.length > 0 ? analytics[analytics.length - 1] : null;

  const metricsHtml = latestAnalytics
    ? `<div class="post-detail-stats">
        <h3>Latest Metrics</h3>
        <div class="stats-grid-sm">
          <div class="stat-card" data-accent="green">
            <div class="stat-label">Likes</div>
            <div class="stat-value">${latestAnalytics.likes}</div>
          </div>
          <div class="stat-card" data-accent="purple">
            <div class="stat-label">Comments</div>
            <div class="stat-value">${latestAnalytics.comments}</div>
          </div>
          <div class="stat-card" data-accent="orange">
            <div class="stat-label">Shares</div>
            <div class="stat-value">${latestAnalytics.shares}</div>
          </div>
          <div class="stat-card" data-accent="teal">
            <div class="stat-label">Impressions</div>
            <div class="stat-value">${latestAnalytics.impressions.toLocaleString()}</div>
          </div>
        </div>
      </div>`
    : "";

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

      <div class="post-detail-grid">
        <div>
          <div class="linkedin-preview">
            <div class="linkedin-preview-header">
              <div class="linkedin-avatar">LI</div>
              <div class="linkedin-author-info">
                <div class="linkedin-author">Your LinkedIn Profile</div>
                <div class="linkedin-timestamp">${post.posted_at ? new Date(post.posted_at).toLocaleDateString() : "Not yet posted"}</div>
              </div>
            </div>
            <div class="post-text">${escapeHtml(post.content).replace(/\n/g, "<br>")}</div>
            ${post.image_data ? `
            <div class="post-image-full" style="margin-top: 18px">
              <img src="/api/posts/${post.id}/image" alt="Post image" class="detail-image">
            </div>` : ""}
          </div>
        </div>

        <div>
          ${metricsHtml}
        </div>
      </div>

      ${analytics.length > 0 ? `
      <div class="chart-container">
        <h3 class="chart-title">Analytics Over Time</h3>
        <div class="chart-wrapper">
          <canvas id="postAnalyticsChart"></canvas>
        </div>
      </div>

      <script>
        window.__POST_ANALYTICS__ = ${JSON.stringify(analytics)};
      </script>` : '<p class="empty-state">No analytics data collected yet.</p>'}
    </div>
  `;

  return layout(`Post #${post.id}`, content, "posts", meta);
}
