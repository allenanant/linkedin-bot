// ─── Toast Notifications ───

function showToast(message, type) {
  var container = document.getElementById("toast-container");
  if (!container) return;
  var toast = document.createElement("div");
  toast.className = "toast toast-" + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(function () {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    toast.style.transition = "opacity 0.3s, transform 0.3s";
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3000);
}

// ─── Chart Rendering ───

var chartColors = {
  blue: "rgba(10, 132, 255, 1)",
  blueFade: "rgba(10, 132, 255, 0.15)",
  green: "rgba(48, 209, 88, 1)",
  greenFade: "rgba(48, 209, 88, 0.15)",
  purple: "rgba(191, 90, 242, 1)",
  purpleFade: "rgba(191, 90, 242, 0.15)",
  orange: "rgba(255, 214, 10, 1)",
  orangeFade: "rgba(255, 214, 10, 0.15)",
  red: "rgba(255, 69, 58, 1)",
  redFade: "rgba(255, 69, 58, 0.15)",
};

// Dark theme for Chart.js
Chart.defaults.color = "rgba(255, 255, 255, 0.45)";
Chart.defaults.borderColor = "rgba(255, 255, 255, 0.06)";

function renderTimelineChart(data) {
  var canvas = document.getElementById("timelineChart");
  if (!canvas) return;

  var labels = data.map(function (d) {
    return d.date;
  });

  new Chart(canvas, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Likes",
          data: data.map(function (d) { return Number(d.likes); }),
          borderColor: chartColors.blue,
          backgroundColor: chartColors.blueFade,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: "Comments",
          data: data.map(function (d) { return Number(d.comments); }),
          borderColor: chartColors.green,
          backgroundColor: chartColors.greenFade,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: "Impressions",
          data: data.map(function (d) { return Number(d.impressions); }),
          borderColor: chartColors.purple,
          backgroundColor: chartColors.purpleFade,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          position: "top",
          labels: { usePointStyle: true, padding: 16 },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 45 },
        },
        y: {
          beginAtZero: true,
          position: "left",
          grid: { color: "rgba(255,255,255,0.05)" },
          title: { display: true, text: "Likes / Comments" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          grid: { drawOnChartArea: false },
          title: { display: true, text: "Impressions" },
        },
      },
    },
  });
}

function renderPostsChart(data) {
  var canvas = document.getElementById("postsChart");
  if (!canvas) return;

  var recent = data.slice(-15);
  var labels = recent.map(function (d) { return d.date; });

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Likes",
          data: recent.map(function (d) { return Number(d.likes); }),
          backgroundColor: chartColors.blue,
          borderRadius: 4,
        },
        {
          label: "Comments",
          data: recent.map(function (d) { return Number(d.comments); }),
          backgroundColor: chartColors.green,
          borderRadius: 4,
        },
        {
          label: "Shares",
          data: recent.map(function (d) { return Number(d.shares); }),
          backgroundColor: chartColors.orange,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { usePointStyle: true, padding: 16 },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 45 },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
    },
  });
}

function renderPostAnalyticsChart(data) {
  var canvas = document.getElementById("postAnalyticsChart");
  if (!canvas) return;

  var labels = data.map(function (d) {
    return new Date(d.fetched_at).toLocaleDateString();
  });

  new Chart(canvas, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Likes",
          data: data.map(function (d) { return d.likes; }),
          borderColor: chartColors.blue,
          backgroundColor: chartColors.blueFade,
          fill: true,
          tension: 0.3,
        },
        {
          label: "Comments",
          data: data.map(function (d) { return d.comments; }),
          borderColor: chartColors.green,
          backgroundColor: chartColors.greenFade,
          fill: true,
          tension: 0.3,
        },
        {
          label: "Shares",
          data: data.map(function (d) { return d.shares; }),
          borderColor: chartColors.orange,
          backgroundColor: chartColors.orangeFade,
          fill: true,
          tension: 0.3,
        },
        {
          label: "Impressions",
          data: data.map(function (d) { return d.impressions; }),
          borderColor: chartColors.purple,
          backgroundColor: chartColors.purpleFade,
          fill: true,
          tension: 0.3,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          position: "top",
          labels: { usePointStyle: true, padding: 16 },
        },
      },
      scales: {
        x: {
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          position: "left",
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          grid: { drawOnChartArea: false },
        },
      },
    },
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
        var card = document.querySelector('[data-draft-id="' + id + '"]');
        if (card) {
          card.style.opacity = "0.5";
          card.style.pointerEvents = "none";
        }
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
        showToast("Published to LinkedIn! ID: " + data.linkedinPostId, "success");
        var card = document.querySelector('[data-draft-id="' + id + '"]');
        if (card) {
          card.style.opacity = "0.5";
          card.style.pointerEvents = "none";
        }
      } else if (data.error) {
        showToast(data.error, "error");
      }
    })
    .catch(function () {
      showToast("Network error publishing draft", "error");
    });
}

function rejectDraft(id) {
  if (!confirm("Are you sure you want to reject this draft?")) return;

  fetch("/api/drafts/" + id + "/reject", { method: "POST" })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success) {
        showToast("Draft rejected", "success");
        var card = document.querySelector('[data-draft-id="' + id + '"]');
        if (card) {
          card.style.opacity = "0.5";
          card.style.pointerEvents = "none";
        }
      } else {
        showToast(data.error || "Failed to reject draft", "error");
      }
    })
    .catch(function () {
      showToast("Network error rejecting draft", "error");
    });
}

// ─── Init ───

document.addEventListener("DOMContentLoaded", function () {
  // Timeline chart (overview page)
  if (window.__TIMELINE_DATA__ && window.__TIMELINE_DATA__.length > 0) {
    renderTimelineChart(window.__TIMELINE_DATA__);
  }

  // Posts comparison chart (overview page)
  if (window.__POSTS_DATA__ && window.__POSTS_DATA__.length > 0) {
    renderPostsChart(window.__POSTS_DATA__);
  }

  // Single post analytics chart (post detail page)
  if (window.__POST_ANALYTICS__ && window.__POST_ANALYTICS__.length > 0) {
    renderPostAnalyticsChart(window.__POST_ANALYTICS__);
  }
});
