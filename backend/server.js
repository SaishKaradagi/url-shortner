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

// Health Check Endpoint - Should be defined before other routes
app.get("/health", async (req, res) => {
  try {
    // Check MongoDB connection status
    const dbState = mongoose.connection.readyState;
    const dbStatus = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    const healthCheck = {
      status: "OK",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus[dbState],
        connected: dbState === 1,
      },
      environment: process.env.NODE_ENV || "development",
    };

    // If database is not connected, return 503
    if (dbState !== 1) {
      return res.status(503).json({
        ...healthCheck,
        status: "Service Unavailable",
      });
    }

    // Ping database to ensure it's responsive
    await mongoose.connection.db.admin().ping();

    res.status(200).json(healthCheck);
  } catch (error) {
    res.status(503).json({
      status: "Service Unavailable",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
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

// For local development
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5050;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// Export for Vercel
export default app;
