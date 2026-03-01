import { layout } from "./layout";

interface Post {
  id: number;
  content: string;
  status: string;
  created_at: string;
  latest_likes: number | null;
  latest_comments: number | null;
  latest_shares: number | null;
  latest_impressions: number | null;
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

function truncate(str: string, len: number): string {
  const escaped = escapeHtml(str);
  if (str.length <= len) return escaped;
  return escapeHtml(str.slice(0, len)) + "&hellip;";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function postsPage(posts: Post[], page: number, total: number, limit: number): string {
  const totalPages = Math.ceil(total / limit);

  const rows = posts
    .map(
      (p) => `
      <tr>
        <td>${new Date(p.created_at).toLocaleDateString()}</td>
        <td class="content-cell">${truncate(p.content, 120)}</td>
        <td>${statusBadge(p.status)}</td>
        <td>${p.latest_likes ?? 0}</td>
        <td>${p.latest_comments ?? 0}</td>
        <td>${p.latest_shares ?? 0}</td>
        <td>${p.latest_impressions ?? 0}</td>
        <td><a href="/posts/${p.id}" class="view-link">View</a></td>
      </tr>`
    )
    .join("\n");

  const prevDisabled = page <= 1 ? "disabled" : "";
  const nextDisabled = page >= totalPages ? "disabled" : "";

  const content = `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Content</th>
            <th>Status</th>
            <th>Likes</th>
            <th>Comments</th>
            <th>Shares</th>
            <th>Impressions</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="8" class="empty-state">No posts found</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="pagination">
      <a href="/posts?page=${page - 1}" class="btn btn-secondary ${prevDisabled}">Previous</a>
      <span class="pagination-info">Page ${page} of ${totalPages || 1}</span>
      <a href="/posts?page=${page + 1}" class="btn btn-secondary ${nextDisabled}">Next</a>
    </div>
  `;

  return layout("Post History", content, "posts");
}
