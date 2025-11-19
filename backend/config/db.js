import mongoose from "mongoose";

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  // 🔍 DEBUG: Log connection attempt
  console.log("=== MongoDB Connection Attempt ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("MONGO_URI exists:", !!process.env.MONGO_URI);
  console.log("MONGO_URI length:", process.env.MONGO_URI?.length || 0);
  // 🔍 Log first and last 20 chars of URI (hide password)
  if (process.env.MONGO_URI) {
    const uri = process.env.MONGO_URI;
    console.log(
      "URI preview:",
      uri.substring(0, 30) + "..." + uri.substring(uri.length - 20)
    );
  }

  if (cached.conn) {
    console.log("✅ Using cached MongoDB connection");
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000, // Increased to 10s
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000, // Added
      family: 4, // Use IPv4, skip trying IPv6
    };

    console.log("🔄 Creating new MongoDB connection with options:", {
      serverSelectionTimeoutMS: opts.serverSelectionTimeoutMS,
      connectTimeoutMS: opts.connectTimeoutMS,
      maxPoolSize: opts.maxPoolSize,
      family: opts.family,
    });

    cached.promise = mongoose
      .connect(process.env.MONGO_URI, opts)
      .then((mongoose) => {
        console.log("✅ MongoDB Connected Successfully!");
        console.log("Connection state:", mongoose.connection.readyState);
        console.log("Host:", mongoose.connection.host);
        console.log("Database:", mongoose.connection.name);
        return mongoose;
      })
      .catch((error) => {
        console.error("❌ MongoDB Connection Error:");
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);

        // Detailed error analysis
        if (error.name === "MongooseServerSelectionError") {
          console.error("🔍 Server Selection Error - Possible causes:");
          console.error("  1. Network Access not configured (0.0.0.0/0)");
          console.error("  2. Incorrect connection string");
          console.error("  3. MongoDB cluster is paused");
          console.error("  4. DNS resolution issue");
        }

        if (error.message.includes("ENOTFOUND")) {
          console.error("🔍 DNS Error - Cannot resolve MongoDB hostname");
        }

        if (error.message.includes("authentication failed")) {
          console.error("🔍 Authentication Error - Check username/password");
        }

        console.error("Full error stack:", error.stack);

        cached.promise = null; // Reset on error
        throw error;
      });
  }

  try {
    console.log("⏳ Awaiting MongoDB connection...");
    cached.conn = await cached.promise;
    console.log("✅ MongoDB connection established and cached");
  } catch (e) {
    console.error("❌ Failed to establish MongoDB connection");
    console.error("Final error:", e.message);
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

// 🔍 Monitor connection events
mongoose.connection.on("connected", () => {
  console.log("📡 Mongoose connected event fired");
});

mongoose.connection.on("error", (err) => {
  console.error("📡 Mongoose connection error event:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("📡 Mongoose disconnected event fired");
});

export default connectDB;
