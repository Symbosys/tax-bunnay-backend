import redis from "../config/redis.config";

/**
 * Cache an item in Redis with an optional TTL (Time to Live) in seconds.
 * Automatically serializes objects and arrays to JSON strings.
 */
export const setCache = async (
  key: string,
  value: any,
  ttlInSeconds?: number
): Promise<void> => {
  try {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (ttlInSeconds && ttlInSeconds > 0) {
      await redis.setex(key, ttlInSeconds, serialized);
    } else {
      await redis.set(key, serialized);
    }
  } catch (error) {
    console.error(`[Redis Util] Failed to set cache for key "${key}":`, error);
  }
};

/**
 * Retrieve a cached item from Redis by key.
 * Automatically deserializes JSON strings back into typed objects.
 */
export const getCache = async <T = any>(key: string): Promise<T | null> => {
  try {
    const data = await redis.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  } catch (error) {
    console.error(`[Redis Util] Failed to get cache for key "${key}":`, error);
    return null;
  }
};

/**
 * Delete one or more keys from Redis.
 */
export const deleteCache = async (key: string | string[]): Promise<number> => {
  try {
    const keys = Array.isArray(key) ? key : [key];
    if (keys.length === 0) return 0;
    return await redis.del(...keys);
  } catch (error) {
    console.error("[Redis Util] Failed to delete cache keys:", error);
    return 0;
  }
};

/**
 * Delete all keys matching a pattern (e.g. "product:*").
 * Uses SCAN to safely avoid blocking the Redis server.
 */
export const deleteCacheByPattern = async (pattern: string): Promise<number> => {
  try {
    let cursor = "0";
    let totalDeleted = 0;

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        const deleted = await redis.del(...keys);
        totalDeleted += deleted;
      }
    } while (cursor !== "0");

    return totalDeleted;
  } catch (error) {
    console.error(
      `[Redis Util] Failed to delete cache by pattern "${pattern}":`,
      error
    );
    return 0;
  }
};

/**
 * Checks if a key exists in Redis.
 */
export const hasCache = async (key: string): Promise<boolean> => {
  try {
    const count = await redis.exists(key);
    return count > 0;
  } catch (error) {
    console.error(`[Redis Util] Failed to check exists for key "${key}":`, error);
    return false;
  }
};

/**
 * Cache-aside helper: Returns cached data if available, otherwise executes the fetcher function,
 * caches the result, and returns it.
 */
export const getOrSetCache = async <T = any>(
  key: string,
  fetcher: () => Promise<T>,
  ttlInSeconds: number = 3600
): Promise<T> => {
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  const freshData = await fetcher();
  if (freshData !== undefined && freshData !== null) {
    await setCache(key, freshData, ttlInSeconds);
  }
  return freshData;
};

/**
 * Checks the health and latency of the Redis connection.
 */
export const checkRedisHealth = async (): Promise<{
  status: "healthy" | "unhealthy";
  ping?: string;
  error?: string;
}> => {
  try {
    const response = await redis.ping();
    return { status: "healthy", ping: response };
  } catch (error: any) {
    return { status: "unhealthy", error: error?.message || "Unknown error" };
  }
};
