import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { env } from "./src/config/env.js";
import { testConnection } from "./src/config/database.js";
import { errorHandler } from "./src/middlewares/errorHandler.js";
import { apiLimiter } from "./src/middlewares/rateLimiter.js";
import authRoutes from "./src/routes/auth.routes.js";
// Phase 2+: import wordRoutes, progressRoutes...

const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true, // Cho phép gửi cookie từ frontend
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ─── Utility Middleware ───────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" })); // Giới hạn body size
app.use(cookieParser()); // Parse httpOnly cookies
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use("/api", apiLimiter);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
// Phase 2+:
// app.use('/api/words',    wordRoutes);
// app.use('/api/progress', authenticate, progressRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_, res) => {
  res.json({
    status: "ok",
    env: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} không tồn tại`,
  });
});

// ─── Global Error Handler (phải đặt CUỐI CÙNG) ───────────────────────────────
app.use(errorHandler);

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const bootstrap = async () => {
  await testConnection(); // Kiểm tra DB trước khi listen

  const PORT = Number(env.PORT);
  app.listen(PORT, () => {
    console.log(`🚀 Server: http://localhost:${PORT} [${env.NODE_ENV}]`);
    console.log(`📡 Health: http://localhost:${PORT}/api/health`);
  });
};

bootstrap().catch((err) => {
  console.error("❌ Bootstrap failed:", err);
  process.exit(1);
});
