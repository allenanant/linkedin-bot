module.exports = {
  apps: [
    {
      name: "linkedin-bot",
      script: "npx",
      args: "tsx src/index.ts schedule",
      cwd: __dirname,
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
      script: "npx",
      args: "tsx src/dashboard/server.ts",
      cwd: __dirname,
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
