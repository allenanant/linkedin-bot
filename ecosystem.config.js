module.exports = {
  apps: [
    {
      name: "linkedin-bot",
      script: "dist/index.js",
      args: "schedule",
      cwd: __dirname,
      interpreter: "node",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 60000,
      env: {
        NODE_ENV: "production",
        // Auto-publish goes through the LinkedIn UI on Chrome 9222 / Xvfb :2
        PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
        DISPLAY: ":2",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "./logs/error.log",
      out_file: "./logs/output.log",
      merge_logs: true,
    },
    {
      name: "linkedin-comment-watcher",
      script: "dist/index.js",
      args: "comment-watch",
      cwd: __dirname,
      interpreter: "node",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 60000,
      env: {
        NODE_ENV: "production",
        // browser-harness needs uv on PATH; Chrome runs on virtual display :2
        PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
        DISPLAY: ":2",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "./logs/cw-error.log",
      out_file: "./logs/cw-output.log",
      merge_logs: true,
    },
  ],
};
