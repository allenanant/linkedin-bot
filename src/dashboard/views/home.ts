import { layout } from "./layout";

interface OverviewData {
  postCount: number;
  imagePostCount: number;
  textPostCount: number;
}

interface Tip {
  content: string;
  generated_at: string;
}

const statIcons = {
  posts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
};

export function homePage(
  overview: OverviewData,
  tip: Tip | null,
  meta?: { draftCount?: number }
): string {
  const tipHtml = tip
    ? `<div class="tip-card-wrapper">
        <div class="tip-card">
          <div class="tip-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <div class="tip-label">AI Insight</div>
          </div>
          <p class="tip-content">${escapeHtml(tip.content)}</p>
          <span class="tip-date">${new Date(tip.generated_at).toLocaleDateString()}</span>
        </div>
      </div>`
    : `<div class="tip-card-wrapper">
        <div class="tip-card">
          <div class="tip-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <div class="tip-label">AI Insight</div>
          </div>
          <p class="tip-content">No tips generated yet. Tips are generated daily at 00:30 UTC.</p>
        </div>
      </div>`;

  const content = `
    <div class="quick-actions">
      <h3 class="quick-actions-title">Quick Actions</h3>
      <div class="quick-actions-grid">
        <button class="quick-action-btn quick-action-news" id="create-news-btn" onclick="createNewsPost()">
          <div class="quick-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
          </div>
          <div class="quick-action-text">
            <span class="quick-action-label">Create News Post</span>
            <span class="quick-action-desc">AI marketing hot take</span>
          </div>
        </button>
        <button class="quick-action-btn quick-action-freebie" id="create-freebie-btn" onclick="createFreebiePost()">
          <div class="quick-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
          </div>
          <div class="quick-action-text">
            <span class="quick-action-label">Create Freebie Post</span>
            <span class="quick-action-desc">Reddit-sourced value post</span>
          </div>
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card" data-accent="blue">
        <div class="stat-card-header">
          <div class="stat-label">Total Posts</div>
          <div class="stat-icon" style="color: var(--accent-blue)">${statIcons.posts}</div>
        </div>
        <div class="stat-value" data-count-to="${overview.postCount}">${overview.postCount}</div>
        <div class="stat-meta">${overview.imagePostCount} image &middot; ${overview.textPostCount} text</div>
      </div>
      <div class="stat-card" data-accent="green">
        <div class="stat-card-header">
          <div class="stat-label">Image Posts</div>
          <div class="stat-icon" style="color: var(--accent-green)">${statIcons.image}</div>
        </div>
        <div class="stat-value" data-count-to="${overview.imagePostCount}">${overview.imagePostCount}</div>
        <div class="stat-meta">Posts with generated images</div>
      </div>
      <div class="stat-card" data-accent="purple">
        <div class="stat-card-header">
          <div class="stat-label">Text Posts</div>
          <div class="stat-icon" style="color: var(--accent-purple)">${statIcons.text}</div>
        </div>
        <div class="stat-value" data-count-to="${overview.textPostCount}">${overview.textPostCount}</div>
        <div class="stat-meta">Text-only posts</div>
      </div>
    </div>

    ${tipHtml}
  `;

  return layout("Overview", content, "overview", meta);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
