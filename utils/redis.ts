// Simple in-memory fallback for development if REDIS_URL/ioredis is not provided

//ill set the redis url in the .env file later but in the dev currently using the in memory cache fallback
const memoryCache = new Map<string, { value: any, expires: number }>();

export async function getCache(key: string) {
  try {
    const { default: Redis } = await import("ioredis");
    const globalForRedis = global as unknown as { redis: any };
    
    if (!globalForRedis.redis && process.env.REDIS_URL) {
      globalForRedis.redis = new Redis(process.env.REDIS_URL);
    }

    if (globalForRedis.redis) {
      const val = await globalForRedis.redis.get(key);
      return val ? JSON.parse(val) : null;
    }
  } catch (e) {
    // Fallback if ioredis is not installed or search fails
  }

  const cached = memoryCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }
  if (cached) memoryCache.delete(key);
  return null;
}

export async function setCache(key: string, value: any, ttlSeconds: number = 3600) {
  try {
    const { default: Redis } = await import("ioredis");
    const globalForRedis = global as unknown as { redis: any };

    if (!globalForRedis.redis && process.env.REDIS_URL) {
      globalForRedis.redis = new Redis(process.env.REDIS_URL);
    }

    if (globalForRedis.redis) {
      await globalForRedis.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
      return;
    }
  } catch (e) {}

  memoryCache.set(key, { 
    value, 
    expires: Date.now() + (ttlSeconds * 1000) 
  });
}

export async function delCache(key: string) {
  try {
    const { default: Redis } = await import("ioredis");
    const globalForRedis = global as unknown as { redis: any };
    
    if (globalForRedis.redis) {
      await globalForRedis.redis.del(key);
      return;
    }
  } catch (e) {}
  
  memoryCache.delete(key);
}
