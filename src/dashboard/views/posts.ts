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

export function postsPage(posts: Post[], page: number, total: number, limit: number, currentStatus?: string, meta?: { draftCount?: number }): string {
  const totalPages = Math.ceil(total / limit);

  // Build status filter param
  const statusParam = currentStatus ? `&status=${currentStatus}` : "";

  // Filter pills
  const filters = [
    { label: "All", value: "", dot: "" },
    { label: "Published", value: "published", dot: "dot-published" },
    { label: "Draft", value: "draft", dot: "dot-draft" },
    { label: "Approved", value: "approved", dot: "dot-approved" },
  ];

  const filterHtml = filters
    .map((f) => {
      const isActive = (currentStatus || "") === f.value;
      const dotHtml = f.dot ? `<span class="dot ${f.dot}"></span>` : "";
      const href = f.value ? `/posts?status=${f.value}` : "/posts";
      return `<a href="${href}" class="filter-pill${isActive ? " active" : ""}">${dotHtml}${f.label}</a>`;
    })
    .join("\n      ");

  const rows = posts
    .map(
      (p) => `
      <tr onclick="window.location='/posts/${p.id}'" style="cursor:pointer">
        <td><span style="font-family: var(--font-mono, monospace); font-size: 13px">${new Date(p.created_at).toLocaleDateString()}</span></td>
        <td class="content-cell"><span class="content-cell-text">${truncate(p.content, 120)}</span></td>
        <td>${statusBadge(p.status)}</td>
        <td>${p.latest_likes ?? 0}</td>
        <td>${p.latest_comments ?? 0}</td>
        <td>${p.latest_shares ?? 0}</td>
        <td>${(p.latest_impressions ?? 0).toLocaleString()}</td>
        <td><a href="/posts/${p.id}" class="view-link">View &rarr;</a></td>
      </tr>`
    )
    .join("\n");

  const emptyRow = `<tr><td colspan="8" class="empty-state">
    <div class="empty-state-container" style="padding: 40px 16px">
      <div class="empty-state-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
      </div>
      <h3>No posts found</h3>
      <p>Posts will appear here once they're created and published.</p>
    </div>
  </td></tr>`;

  const prevDisabled = page <= 1 ? "disabled" : "";
  const nextDisabled = page >= totalPages ? "disabled" : "";

  // Pagination with page numbers
  let pageNumbers = "";
  if (totalPages > 1) {
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
        pages.push(i);
      }
    }
    // Insert ellipsis
    const pagesHtml: string[] = [];
    let lastP = 0;
    for (const p of pages) {
      if (lastP && p - lastP > 1) {
        pagesHtml.push(`<span class="pagination-ellipsis">&hellip;</span>`);
      }
      const activeClass = p === page ? " active" : "";
      pagesHtml.push(`<a href="/posts?page=${p}${statusParam}" class="pagination-num${activeClass}">${p}</a>`);
      lastP = p;
    }
    pageNumbers = pagesHtml.join("");
  }

  const content = `
    <div class="filter-bar">
      ${filterHtml}
    </div>

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
          ${rows || emptyRow}
        </tbody>
      </table>
    </div>

    <div class="pagination">
      <a href="/posts?page=${page - 1}${statusParam}" class="btn btn-secondary ${prevDisabled}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Prev
      </a>
      ${pageNumbers}
      <span class="pagination-info">Page ${page} of ${totalPages || 1}</span>
      <a href="/posts?page=${page + 1}${statusParam}" class="btn btn-secondary ${nextDisabled}">
        Next
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </a>
    </div>
  `;

  return layout("Post History", content, "posts", meta);
}
