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
  if (pct > 0) return `<span class="change change-up">+${pct}%</span>`;
  if (pct < 0) return `<span class="change change-down">${pct}%</span>`;
  return `<span class="change change-neutral">0%</span>`;
}

export function homePage(
  overview: OverviewData,
  changes: WeeklyChanges,
  timeline: TimelineEntry[],
  postsData: TimelineEntry[],
  tip: Tip | null
): string {
  const tipHtml = tip
    ? `<div class="tip-card">
        <div class="tip-label">Daily AI Tip</div>
        <p class="tip-content">${escapeHtml(tip.content)}</p>
        <span class="tip-date">${new Date(tip.generated_at).toLocaleDateString()}</span>
      </div>`
    : `<div class="tip-card">
        <div class="tip-label">Daily AI Tip</div>
        <p class="tip-content">No tips generated yet. Tips are generated daily at 00:30 UTC.</p>
      </div>`;

  const content = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Posts</div>
        <div class="stat-value">${overview.postCount}</div>
        <div class="stat-meta">${overview.imagePostCount} image / ${overview.textPostCount} text</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Likes</div>
        <div class="stat-value">${overview.totalLikes.toLocaleString()}</div>
        ${changeIndicator(changes.likesChange)}
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Comments</div>
        <div class="stat-value">${overview.totalComments.toLocaleString()}</div>
        ${changeIndicator(changes.commentsChange)}
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Impressions</div>
        <div class="stat-value">${overview.totalImpressions.toLocaleString()}</div>
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

  return layout("Overview", content, "overview");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
