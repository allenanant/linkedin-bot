import { layout } from "./layout";

interface Draft {
  id: number;
  content: string;
  image_data: Buffer | null;
  created_at: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function draftsPage(drafts: Draft[]): string {
  if (drafts.length === 0) {
    const content = `
      <div class="empty-state-container">
        <div class="empty-state-icon">&#128221;</div>
        <h3>No pending drafts</h3>
        <p>All caught up! New drafts will appear here when generated.</p>
      </div>
    `;
    return layout("Draft Approval", content, "drafts");
  }

  const cards = drafts
    .map(
      (d) => `
      <div class="draft-card" data-draft-id="${d.id}">
        <div class="draft-header">
          <span class="draft-date">${new Date(d.created_at).toLocaleDateString()}</span>
          <span class="badge badge-draft">draft</span>
        </div>
        ${d.image_data ? `<div class="draft-image"><img src="/api/posts/${d.id}/image" alt="Post image" loading="lazy"></div>` : ""}
        <div class="draft-content">
          <textarea class="draft-textarea" id="draft-content-${d.id}" rows="8">${escapeHtml(d.content)}</textarea>
        </div>
        <div class="draft-actions">
          <button class="btn btn-save" onclick="saveDraft(${d.id})">Save Edits</button>
          <button class="btn btn-approve" onclick="approveDraft(${d.id})">Approve</button>
          <button class="btn btn-publish" onclick="publishDraft(${d.id})">Approve &amp; Publish Now</button>
          <button class="btn btn-reject" onclick="rejectDraft(${d.id})">Reject</button>
        </div>
      </div>`
    )
    .join("\n");

  const content = `
    <div class="drafts-list">
      ${cards}
    </div>
  `;

  return layout("Draft Approval", content, "drafts");
}
