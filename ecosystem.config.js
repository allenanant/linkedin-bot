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
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "./logs/error.log",
      out_file: "./logs/output.log",
      merge_logs: true,
    },
    {
      name: "linkedin-dashboard",
      script: "dist/dashboard/server.js",
      cwd: __dirname,
      interpreter: "node",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "./logs/dashboard-error.log",
      out_file: "./logs/dashboard-output.log",
      merge_logs: true,
    },
  ],
};
