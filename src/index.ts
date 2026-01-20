import "dotenv/config";
import express from "express";
import cors from "cors";
import { usersRouter, adminRouter } from "./routes/index.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Info
app.get("/", (req, res) => {
  res.json({
    name: "Social Persona Card System API",
    version: "1.1.0",
    description:
      "AI-powered Farcaster persona generation with on-demand card rendering.",
    endpoints: {
      "GET /api/users/:fid/card-latest":
        "Fetch generated card data (Persona + Context)",
      "POST /api/users/:fid/cards":
        "Trigger persona generation & context update",
      "POST /api/admin/users/:fid/full-pipeline":
        "Run complete flow (Ingest -> Persona)",
      "POST /api/admin/users/:fid/ingest-now": "Trigger raw data collection",
      "POST /api/admin/users/:fid/persona-now": "Trigger persona generation",
      "GET /api/admin/credits": "Check Neynar API credit status",
    },
    workflow: [
      "1. [Data]  POST /api/admin/users/:fid/ingest-now  - Collect casts & compute stats",
      "2. [AI]    POST /api/admin/users/:fid/persona-now - Generate persona",
      "3. [Fetch] GET /api/users/:fid/card-latest        - Get final card JSON",
      "--- Tip: Use /api/admin/users/:fid/full-pipeline for one-step execution ---",
    ],
    testing: {
      script: "npm run test:user-data",
      output: "temp/user-data-:fid.json",
    },
  });
});

// Routes
app.use("/api/users", usersRouter);
app.use("/api/admin", adminRouter);

// Error handling
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("[Server] Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  },
);

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║          Social Persona Card System - API Server           ║
╠════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                   ║
║                                                            ║
║  Endpoints:                                                ║
║    GET  /                           - API info             ║
║    GET  /api/users/:fid/card-latest - Refined card data    ║
║    POST /api/users/:fid/cards       - Gen/Refine persona   ║
║    POST /api/admin/users/:fid/full-pipeline - Full flow    ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
