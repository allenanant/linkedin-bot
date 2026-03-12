import { layout } from "./layout";

interface Draft {
  id: number;
  content: string;
  has_image: boolean;
  created_at: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function draftsPage(drafts: Draft[], meta?: { draftCount?: number }): string {
  if (drafts.length === 0) {
    const content = `
      <div class="empty-state-container">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h3>All caught up!</h3>
        <p>No pending drafts. New drafts will appear here when the bot generates content.</p>
      </div>
    `;
    return layout("Draft Approval", content, "drafts", meta);
  }

  const cards = drafts
    .map(
      (d, i) => `
      <div class="draft-card" data-draft-id="${d.id}">
        <div class="draft-header">
          <div class="draft-header-left">
            <span class="draft-number">#${i + 1}</span>
            <span class="draft-date">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${new Date(d.created_at).toLocaleDateString()}
            </span>
          </div>
          <span class="badge badge-draft">draft</span>
        </div>
        ${d.has_image ? `<div class="draft-image"><img src="/api/posts/${d.id}/image" alt="Post image" loading="lazy"></div>` : ""}
        <div class="draft-content">
          <textarea class="draft-textarea" id="draft-content-${d.id}" rows="8" oninput="updateCharCount(this)">${escapeHtml(d.content)}</textarea>
          <div class="char-count" id="char-count-${d.id}">${d.content.length} / 3,000</div>
        </div>
        <div class="draft-actions">
          <div class="draft-actions-primary">
            <button class="btn btn-approve" onclick="approveDraft(${d.id})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Approve
            </button>
            <button class="btn btn-publish" onclick="publishDraft(${d.id})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Approve &amp; Publish
            </button>
          </div>
          <div class="draft-actions-secondary">
            <button class="btn btn-save" onclick="saveDraft(${d.id})">Save Edits</button>
            <button class="btn btn-reject" onclick="rejectDraft(${d.id})">Reject</button>
          </div>
        </div>
      </div>`
    )
    .join("\n");

  const content = `
    <div class="drafts-list">
      ${cards}
    </div>
  `;

  return layout("Draft Approval", content, "drafts", meta);
}
