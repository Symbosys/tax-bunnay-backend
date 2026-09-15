import { Redis } from "ioredis";
import { env } from "./env.config";

export const redis = new Redis(env.redis.url, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
  lazyConnect: false,
});

redis.on("connect", () => {
  console.log("🔴 [Redis] Connecting to Redis server...");
});

redis.on("ready", () => {
  console.log(`✅ [Redis] Connected successfully to: ${env.redis.url}`);
});

redis.on("error", (err) => {
  console.error("❌ [Redis] Connection error:", err.message);
});

redis.on("close", () => {
  console.warn("⚠️ [Redis] Connection closed");
});

export default redis;
