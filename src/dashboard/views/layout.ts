export function layout(title: string, content: string, activePage: string): string {
  const navItems = [
    { href: "/", label: "Overview", page: "overview" },
    { href: "/posts", label: "Posts", page: "posts" },
    { href: "/drafts", label: "Drafts", page: "drafts" },
  ];

  const navHtml = navItems
    .map(
      (item) =>
        `<a href="${item.href}" class="nav-link${activePage === item.page ? " active" : ""}">${item.label}</a>`
    )
    .join("\n          ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - LinkedIn Bot Dashboard</title>
  <link rel="stylesheet" href="/public/style.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1 class="sidebar-logo">LI Bot</h1>
        <span class="sidebar-subtitle">Dashboard</span>
      </div>
      <nav class="sidebar-nav">
        ${navHtml}
      </nav>
      <div class="sidebar-footer">
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
