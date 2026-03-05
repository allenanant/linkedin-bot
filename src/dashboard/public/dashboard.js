// ═══════════════════════════════════════════════════════════
// LinkedIn Bot Dashboard — Client JS
// ═══════════════════════════════════════════════════════════

// ─── Toast Notifications ───

function showToast(message, type) {
  var container = document.getElementById("toast-container");
  if (!container) return;

  var toast = document.createElement("div");
  toast.className = "toast toast-" + type;

  var icon = type === "success"
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

  toast.innerHTML = icon + '<span>' + message + '</span>';
  container.appendChild(toast);

  setTimeout(function () {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(24px)";
    toast.style.transition = "opacity 0.3s, transform 0.3s";
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3500);
}

// ─── Animated Counters ───

function animateCounters() {
  var counters = document.querySelectorAll("[data-count-to]");
  if (!counters.length) return;

  counters.forEach(function (el) {
    var target = parseInt(el.getAttribute("data-count-to"), 10);
    if (isNaN(target) || target === 0) return;

    var duration = 1200;
    var startTime = null;

    // Easing function — ease-out cubic
    function easeOut(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var elapsed = timestamp - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var easedProgress = easeOut(progress);
      var current = Math.round(easedProgress * target);

      el.textContent = current.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    // Start counting from 0
    el.textContent = "0";
    requestAnimationFrame(step);
  });
}

// ─── Character Count for Draft Textareas ───

function updateCharCount(textarea) {
  var len = textarea.value.length;
  var draftId = textarea.id.replace("draft-content-", "");
  var countEl = document.getElementById("char-count-" + draftId);
  if (!countEl) return;

  countEl.textContent = len.toLocaleString() + " / 3,000";
  countEl.classList.remove("warn", "over");
  if (len > 3000) {
    countEl.classList.add("over");
  } else if (len > 2500) {
    countEl.classList.add("warn");
  }
}

// ─── Confirmation Modal ───

function showConfirmModal(title, desc, onConfirm) {
  var overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  overlay.innerHTML = '<div class="modal-box">' +
    '<div class="modal-icon">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
    '</div>' +
    '<h3 class="modal-title">' + title + '</h3>' +
    '<p class="modal-desc">' + desc + '</p>' +
    '<div class="modal-actions">' +
    '<button class="btn btn-ghost" id="modal-cancel">Cancel</button>' +
    '<button class="btn btn-reject" style="background: var(--accent-red); color: #fff; border: none;" id="modal-confirm">Reject</button>' +
    '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  // Close on overlay click
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) {
      closeModal(overlay);
    }
  });

  document.getElementById("modal-cancel").addEventListener("click", function () {
    closeModal(overlay);
  });

  document.getElementById("modal-confirm").addEventListener("click", function () {
    closeModal(overlay);
    onConfirm();
  });

  // Close on Escape
  function onEsc(e) {
    if (e.key === "Escape") {
      closeModal(overlay);
      document.removeEventListener("keydown", onEsc);
    }
  }
  document.addEventListener("keydown", onEsc);
}

function closeModal(overlay) {
  overlay.style.opacity = "0";
  overlay.style.transition = "opacity 0.2s";
  setTimeout(function () {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }, 200);
}

// ─── Card Dismiss Animation ───

function dismissCard(id, callback) {
  var card = document.querySelector('[data-draft-id="' + id + '"]');
  if (!card) {
    if (callback) callback();
    return;
  }

  card.classList.add("dismissing");
  setTimeout(function () {
    if (card.parentNode) card.parentNode.removeChild(card);

    // Check if no more drafts
    var remaining = document.querySelectorAll(".draft-card");
    if (remaining.length === 0) {
      var list = document.querySelector(".drafts-list");
      if (list) {
        list.innerHTML =
          '<div class="empty-state-container">' +
          '<div class="empty-state-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
          '</div>' +
          '<h3>All caught up!</h3>' +
          '<p>No pending drafts. New drafts will appear here when the bot generates content.</p>' +
          '</div>';
      }
    }

    if (callback) callback();
  }, 550);
}

// ─── Quick Actions: Create Posts ───

function createNewsPost() {
  var btn = document.getElementById("create-news-btn");
  if (!btn) return;
  btn.disabled = true;
  btn.querySelector(".quick-action-label").textContent = "Generating...";
  btn.querySelector(".quick-action-desc").textContent = "This takes about 1 minute";

  fetch("/api/create/news", { method: "POST" })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success) {
        showToast("News post draft created!", "success");
        setTimeout(function () { window.location.href = "/drafts"; }, 1000);
      } else {
        showToast(data.error || "Failed to create news post", "error");
        btn.disabled = false;
        btn.querySelector(".quick-action-label").textContent = "Create News Post";
        btn.querySelector(".quick-action-desc").textContent = "AI marketing hot take";
      }
    })
    .catch(function () {
      showToast("Network error creating news post", "error");
      btn.disabled = false;
      btn.querySelector(".quick-action-label").textContent = "Create News Post";
      btn.querySelector(".quick-action-desc").textContent = "AI marketing hot take";
    });
}

function createFreebiePost() {
  var btn = document.getElementById("create-freebie-btn");
  if (!btn) return;
  btn.disabled = true;
  btn.querySelector(".quick-action-label").textContent = "Generating...";
  btn.querySelector(".quick-action-desc").textContent = "This takes about 1 minute";

  fetch("/api/create/freebie", { method: "POST" })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success) {
        showToast("Freebie post draft created!", "success");
        setTimeout(function () { window.location.href = "/drafts"; }, 1000);
      } else {
        showToast(data.error || "Failed to create freebie post", "error");
        btn.disabled = false;
        btn.querySelector(".quick-action-label").textContent = "Create Freebie Post";
        btn.querySelector(".quick-action-desc").textContent = "Reddit-sourced value post";
      }
    })
    .catch(function () {
      showToast("Network error creating freebie post", "error");
      btn.disabled = false;
      btn.querySelector(".quick-action-label").textContent = "Create Freebie Post";
      btn.querySelector(".quick-action-desc").textContent = "Reddit-sourced value post";
    });
}

// ─── Draft Actions ───

function saveDraft(id) {
  var textarea = document.getElementById("draft-content-" + id);
  if (!textarea) return;

  fetch("/api/drafts/" + id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: textarea.value }),
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success) {
        showToast("Draft saved successfully", "success");
      } else {
        showToast(data.error || "Failed to save draft", "error");
      }
    })
    .catch(function () {
      showToast("Network error saving draft", "error");
    });
}

function approveDraft(id) {
  fetch("/api/drafts/" + id + "/approve", { method: "POST" })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success) {
        showToast("Draft approved", "success");
        dismissCard(id);
      } else {
        showToast(data.error || "Failed to approve draft", "error");
      }
    })
    .catch(function () {
      showToast("Network error approving draft", "error");
    });
}

function publishDraft(id) {
  fetch("/api/drafts/" + id + "/approve?immediate=true", { method: "POST" })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success && data.published) {
        showToast("Published to LinkedIn!", "success");
        dismissCard(id);
      } else if (data.error) {
        showToast(data.error, "error");
      }
    })
    .catch(function () {
      showToast("Network error publishing draft", "error");
    });
}

function rejectDraft(id) {
  showConfirmModal(
    "Reject Draft",
    "This draft will be permanently removed. This action cannot be undone.",
    function () {
      fetch("/api/drafts/" + id + "/reject", { method: "POST" })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.success) {
            showToast("Draft rejected", "success");
            dismissCard(id);
          } else {
            showToast(data.error || "Failed to reject draft", "error");
          }
        })
        .catch(function () {
          showToast("Network error rejecting draft", "error");
        });
    }
  );
}

// ─── Init ───

document.addEventListener("DOMContentLoaded", function () {
  // Animated counters (overview page)
  animateCounters();

  // Initialize char counts for all draft textareas
  var textareas = document.querySelectorAll(".draft-textarea");
  textareas.forEach(function (ta) {
    updateCharCount(ta);
  });
});
