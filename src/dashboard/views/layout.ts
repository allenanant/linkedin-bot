export function layout(title: string, content: string, activePage: string, meta?: { draftCount?: number }): string {
  const draftCount = meta?.draftCount ?? 0;

  const icons: Record<string, string> = {
    overview: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    posts: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
    drafts: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  };

  const navItems = [
    { href: "/", label: "Overview", page: "overview" },
    { href: "/posts", label: "Posts", page: "posts" },
    { href: "/drafts", label: "Drafts", page: "drafts" },
  ];

  const navHtml = navItems
    .map((item) => {
      const isActive = activePage === item.page;
      const badge = item.page === "drafts" && draftCount > 0
        ? `<span class="nav-badge">${draftCount}</span>`
        : "";
      return `<a href="${item.href}" class="nav-link${isActive ? " active" : ""}">${icons[item.page] || ""}${item.label}${badge}</a>`;
    })
    .join("\n          ");

  // Mobile tab icons (slightly different — filled style for active)
  const tabIcons: Record<string, string> = {
    overview: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    posts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    drafts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  };

  const tabBarHtml = navItems
    .map((item) => {
      const isActive = activePage === item.page;
      const tabBadge = item.page === "drafts" && draftCount > 0
        ? `<span class="tab-badge">${draftCount}</span>`
        : "";
      return `<a href="${item.href}" class="tab-link${isActive ? " active" : ""}">
        <div class="tab-link-wrapper">${tabIcons[item.page] || ""}${tabBadge}</div>
        <span>${item.label}</span>
      </a>`;
    })
    .join("\n        ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${escapeHtml(title)} - LinkedIn Bot Dashboard</title>
  <link rel="icon" type="image/png" href="/public/logo.png">
  <link rel="apple-touch-icon" href="/public/logo.png">
  <meta name="theme-color" content="#050507">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="stylesheet" href="/public/style.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <img src="/public/logo.png" alt="Logo" class="sidebar-logo-img">
          <h1 class="sidebar-logo">LI Bot</h1>
        </div>
        <span class="sidebar-subtitle">Dashboard</span>
      </div>
      <nav class="sidebar-nav">
        ${navHtml}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-status">
          <span class="status-dot"></span>
          <span>Bot Active</span>
        </div>
        <span class="sidebar-version">v1.0.0</span>
      </div>
    </aside>
    <main class="main-content">
      <header class="content-header">
        <h2 class="page-title">${escapeHtml(title)}</h2>
      </header>
      <div class="content-body">
        ${content}
      </div>
    </main>
  </div>

  <nav class="mobile-tab-bar">
    <div class="tab-bar-inner">
      ${tabBarHtml}
    </div>
  </nav>

  <div id="toast-container"></div>
  <script src="/public/dashboard.js"></script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
