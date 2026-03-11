import cron from "node-cron";

export function scheduleDailyJobs(
  times: string[],
  timezone: string,
  job: () => Promise<void>
) {
  for (const time of times) {
    const [hour, minute] = time.split(":");
    const cronExpression = `${minute} ${hour} * * *`;

    console.log(`Scheduling daily job: ${cronExpression} (${timezone}) - ${time}`);

    cron.schedule(
      cronExpression,
      async () => {
        console.log(`[${new Date().toISOString()}] Cron triggered (${time}) - running daily pipeline`);
        try {
          await job();
        } catch (err: any) {
          console.error(`[${new Date().toISOString()}] Cron job failed: ${err.message}`);
        }
      },
      { timezone }
    );
  }

  console.log(`\n${times.length} daily posts scheduled: ${times.join(", ")} (${timezone})`);
  console.log("Press Ctrl+C to stop.\n");

  process.on("SIGINT", () => {
    console.log("\nScheduler stopped.");
    process.exit(0);
  });
}
