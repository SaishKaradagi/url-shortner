import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.js";
import urlRoutes from "./routes/url.js";
import Url from "./models/Url.js";

dotenv.config();
const app = express();

// Configure CORS properly
const allowedOrigins = [
  "https://url-shortner-4cmo.vercel.app", // Your frontend URL
  "http://localhost:5173", // Local development
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parser middleware - MUST come before routes
app.use(express.json());

// Handle preflight requests
app.options("*", cors());

// Connect to database
connectDB();

// 🔍 DEBUG endpoint - Add this after connectDB() call
app.get("/debug/connection", async (req, res) => {
  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasMongoURI: !!process.env.MONGO_URI,
        mongoURILength: process.env.MONGO_URI?.length || 0,
        mongoURIPreview: process.env.MONGO_URI
          ? process.env.MONGO_URI.substring(0, 30) + "..."
          : "NOT SET",
      },
      mongoose: {
        readyState: mongoose.connection.readyState,
        readyStateText: {
          0: "disconnected",
          1: "connected",
          2: "connecting",
          3: "disconnecting",
        }[mongoose.connection.readyState],
        host: mongoose.connection.host || "N/A",
        name: mongoose.connection.name || "N/A",
      },
      vercel: {
        region: process.env.VERCEL_REGION || "N/A",
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID || "N/A",
      },
    };

    res.status(200).json(debugInfo);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
});

// Health Check Endpoint - Should be defined before other routes
// Quick health check - no database ping
app.get("/health", async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStatus = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    const healthCheck = {
      status: dbState === 1 ? "OK" : "Degraded",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus[dbState],
        connected: dbState === 1,
      },
      environment: process.env.NODE_ENV || "development",
    };

    // Return 200 even if DB is connecting (for cold starts)
    const statusCode = dbState === 1 ? 200 : 503;
    res.status(statusCode).json(healthCheck);
  } catch (error) {
    res.status(503).json({
      status: "Service Unavailable",
      error: error.message,
    });
  }
});

// Deep health check with database ping (slower)
app.get("/health/deep", async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;

    if (dbState !== 1) {
      return res.status(503).json({
        status: "Service Unavailable",
        database: { connected: false },
      });
    }

    // Ping database
    await mongoose.connection.db.admin().ping();

    res.status(200).json({
      status: "OK",
      timestamp: new Date().toISOString(),
      database: { connected: true, ping: "successful" },
    });
  } catch (error) {
    res.status(503).json({
      status: "Service Unavailable",
      error: error.message,
    });
  }
});

// Liveness probe - Simple endpoint for basic availability check
app.get("/livez", (req, res) => {
  res.status(200).json({ status: "alive" });
});

// Readiness probe - Check if app is ready to serve traffic
app.get("/readyz", async (req, res) => {
  const isReady = mongoose.connection.readyState === 1;
  if (isReady) {
    res.status(200).json({ status: "ready" });
  } else {
    res.status(503).json({ status: "not ready" });
  }
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/url", urlRoutes);

// Redirect route (public) - MUST be after API routes
app.get("/:shortId", async (req, res) => {
  const { shortId } = req.params;
  try {
    const url = await Url.findOne({ shortId });
    if (!url) return res.status(404).send("Not found");

    url.clicks += 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last = url.clickHistory[url.clickHistory.length - 1];

    if (last && new Date(last.date).getTime() === today.getTime()) {
      last.count += 1;
    } else {
      url.clickHistory.push({ date: today, count: 1 });
    }

    await url.save();
    return res.redirect(url.longUrl);
  } catch (err) {
    return res.status(500).send("Server error");
  }
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
  });
});

// ✅ CORRECTED: Always listen (Vercel handles this properly)
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Export for Vercel serverless
export default app;
