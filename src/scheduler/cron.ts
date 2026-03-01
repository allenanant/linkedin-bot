import cron from "node-cron";

export function scheduleDailyJob(
  time: string,
  timezone: string,
  job: () => Promise<void>
) {
  const [hour, minute] = time.split(":");
  const cronExpression = `${minute} ${hour} * * *`;

  console.log(`Scheduling daily job: ${cronExpression} (${timezone})`);
  console.log(`Next run: ${time} ${timezone}`);
  console.log("Press Ctrl+C to stop.\n");

  cron.schedule(
    cronExpression,
    async () => {
      console.log(`[${new Date().toISOString()}] Cron triggered - running daily pipeline`);
      try {
        await job();
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Cron job failed: ${err.message}`);
      }
    },
    { timezone }
  );

  // Keep process alive
  process.on("SIGINT", () => {
    console.log("\nScheduler stopped.");
    process.exit(0);
  });
}
