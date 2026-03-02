import { layout } from "./layout";

interface OverviewData {
  postCount: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalImpressions: number;
  imagePostCount: number;
  textPostCount: number;
}

interface WeeklyChanges {
  likesChange: number;
  commentsChange: number;
  sharesChange: number;
  impressionsChange: number;
}

interface TimelineEntry {
  date: string;
  posts: number;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
}

interface Tip {
  content: string;
  generated_at: string;
}

function changeIndicator(pct: number): string {
  if (pct > 0) return `<span class="change change-up">&#9650; +${pct}%</span>`;
  if (pct < 0) return `<span class="change change-down">&#9660; ${pct}%</span>`;
  return `<span class="change change-neutral">&mdash; 0%</span>`;
}

const statIcons = {
  posts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  likes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  comments: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  impressions: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
};

export function homePage(
  overview: OverviewData,
  changes: WeeklyChanges,
  timeline: TimelineEntry[],
  postsData: TimelineEntry[],
  tip: Tip | null,
  meta?: { draftCount?: number; lastAnalyticsUpdate?: string | null }
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

  const lastUpdateStr = meta?.lastAnalyticsUpdate
    ? `Updated ${new Date(meta.lastAnalyticsUpdate).toLocaleString()}`
    : "No analytics fetched yet";

  const content = `
    <div class="overview-toolbar">
      <div class="overview-status">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span class="overview-last-update">${lastUpdateStr}</span>
      </div>
      <button class="btn btn-secondary btn-sm" id="refresh-analytics-btn" onclick="refreshAnalytics()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        Refresh
      </button>
    </div>

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
          <div class="stat-label">Total Likes</div>
          <div class="stat-icon" style="color: var(--accent-green)">${statIcons.likes}</div>
        </div>
        <div class="stat-value" data-count-to="${overview.totalLikes}">${overview.totalLikes.toLocaleString()}</div>
        ${changeIndicator(changes.likesChange)}
      </div>
      <div class="stat-card" data-accent="purple">
        <div class="stat-card-header">
          <div class="stat-label">Total Comments</div>
          <div class="stat-icon" style="color: var(--accent-purple)">${statIcons.comments}</div>
        </div>
        <div class="stat-value" data-count-to="${overview.totalComments}">${overview.totalComments.toLocaleString()}</div>
        ${changeIndicator(changes.commentsChange)}
      </div>
      <div class="stat-card" data-accent="teal">
        <div class="stat-card-header">
          <div class="stat-label">Total Impressions</div>
          <div class="stat-icon" style="color: var(--accent-teal)">${statIcons.impressions}</div>
        </div>
        <div class="stat-value" data-count-to="${overview.totalImpressions}">${overview.totalImpressions.toLocaleString()}</div>
        ${changeIndicator(changes.impressionsChange)}
      </div>
    </div>

    ${tipHtml}

    <div class="charts-grid">
      <div class="chart-container">
        <h3 class="chart-title">Engagement Timeline</h3>
        <div class="chart-wrapper">
          <canvas id="timelineChart"></canvas>
        </div>
      </div>
      <div class="chart-container">
        <h3 class="chart-title">Posts Overview</h3>
        <div class="chart-wrapper">
          <canvas id="postsChart"></canvas>
        </div>
      </div>
    </div>

    <script>
      window.__TIMELINE_DATA__ = ${JSON.stringify(timeline)};
      window.__POSTS_DATA__ = ${JSON.stringify(postsData)};
    </script>
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
