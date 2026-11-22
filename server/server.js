import express from "express";
import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import connectDB, { disconnectDB } from "./config/db.js";
import authRouter from "./routes/authRoutes.js";
import projectRouter from "./routes/projectRoutes.js";

const app = express();

const allowedOrigins = process.env.ORIGINS
    ? process.env.ORIGINS.split(",").map(o => o.trim())
    : ["http://localhost:5173", "http://localhost:3000"];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
}));

app.use(cookieParser());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatusMap = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting"
    };
    res.status(dbState === 1 ? 200 : 503).json({
        status: dbState === 1 ? "ok" : "degraded",
        database: dbStatusMap[dbState] || "unknown",
        uptime: process.uptime()
    });
});

app.get("/", (req, res) => res.send("Server is Live!"));

// Database guard middleware: prevent API queries from executing when disconnected
app.use("/api", (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            error: "Database service unavailable. Connection is not active.",
            code: "DATABASE_UNAVAILABLE"
        });
    }
    next();
});

app.use("/api/auth", authRouter);
app.use("/api/projects", projectRouter);

// Centralized error handler
app.use((err, _req, res, _next) => {
    console.error(`[Error] ${err.message}`);
    res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

const port = process.env.PORT || 3000;
let server;

async function startServer() {
    try {
        // Ensure MongoDB connects successfully before starting the Express server
        await connectDB();

        server = app.listen(port, () => {
            console.log(`Server is running at http://localhost:${port}`);
        });
    } catch (err) {
        console.error("[Fatal] Failed to initialize database. Server startup aborted:", err.message);
        process.exit(1);
    }
}

// Graceful shutdown handling
async function gracefulShutdown(signal) {
    console.log(`\n[Shutdown] Received ${signal}. Closing server gracefully...`);
    if (server) {
        server.close(async () => {
            console.log("[Shutdown] HTTP server closed.");
            try {
                await disconnectDB();
                console.log("[Shutdown] Database connection closed.");
                process.exit(0);
            } catch (dbErr) {
                console.error("[Shutdown] Error during database disconnect:", dbErr.message);
                process.exit(1);
            }
        });

        // Force shutdown if cleanup takes too long
        setTimeout(() => {
            console.error("[Shutdown] Forcefully terminating process after timeout.");
            process.exit(1);
        }, 10000).unref();
    } else {
        process.exit(0);
    }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

startServer();

export default app;
