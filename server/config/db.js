import mongoose from "mongoose";
import dns from "dns";

// Configure DNS servers and resolution order to avoid SRV query issues on Windows/ISP resolvers
try {
    dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
    if (dns.setDefaultResultOrder) {
        dns.setDefaultResultOrder("ipv4first");
    }
} catch (dnsErr) {
    console.warn("[Database] Custom DNS configuration warning:", dnsErr.message);
}

// Track connection listener attachment to avoid duplicate listeners on hot reload
let listenersAttached = false;

function setupConnectionEvents() {
    if (listenersAttached) return;
    listenersAttached = true;

    mongoose.connection.on("connected", () => {
        console.log("[Database] MongoDB connection established successfully.");
    });

    mongoose.connection.on("error", (err) => {
        console.error("[Database] MongoDB connection error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
        console.warn("[Database] MongoDB disconnected. Waiting for reconnection...");
    });

    mongoose.connection.on("reconnected", () => {
        console.log("[Database] MongoDB connection re-established.");
    });
}

const connectionOptions = {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
    retryWrites: true,
    retryReads: true,
};

export const connectDB = async () => {
    // If already connected, return existing connection
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        const errorMsg = "[Database] Error: MONGODB_URI environment variable is not defined in .env";
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    setupConnectionEvents();

    try {
        // Sanitize URI so credentials are never exposed in logs
        const sanitizedUri = uri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
        console.log(`[Database] Connecting to MongoDB Atlas (${sanitizedUri.split('@')[1] || 'cluster'})...`);

        await mongoose.connect(uri, connectionOptions);
        return mongoose.connection;
    } catch (error) {
        console.error("[Database] MongoDB initial connection failed:", error.message);
        if (error.name === "MongooseServerSelectionError") {
            console.error("[Database] Troubleshooting Tips:");
            console.error("  1. Network Access: Ensure your public IP address is in the MongoDB Atlas IP Access List (whitelist).");
            console.error("  2. Cluster State: Ensure your cluster is active and not paused in Atlas.");
            console.error("  3. Firewall / Port: Ensure outbound traffic to port 27017 is permitted.");
            console.error("  4. Credentials: Confirm your username and password in MONGODB_URI are correct.");
        }
        throw error;
    }
};

export const disconnectDB = async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        console.log("[Database] MongoDB disconnected successfully.");
    }
};

export default connectDB;
