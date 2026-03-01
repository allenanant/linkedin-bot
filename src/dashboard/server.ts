import express from "express";
import path from "path";
import { config } from "../config";
import { initDb } from "../storage/db";
import apiRoutes from "./routes/api";
import pageRoutes from "./routes/pages";
import { scheduleTipGeneration } from "./tips-generator";

async function startServer(): Promise<void> {
  await initDb();

  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve static files
  app.use("/public", express.static(path.join(__dirname, "public")));

  // Routes
  app.use(apiRoutes);
  app.use(pageRoutes);

  // Schedule daily tip generation
  scheduleTipGeneration();

  const port = config.dashboard.port;
  app.listen(port, () => {
    console.log(`Dashboard running at http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start dashboard:", err);
  process.exit(1);
});
