import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN"
    );
  }
  return new Redis({ url, token });
}

const limiters = new Map<string, Ratelimit>();

function getLimiter(prefix: string, maxAttempts: number, windowMs: number): Ratelimit {
  const key = `${prefix}:${maxAttempts}:${windowMs}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    const windowSec = `${Math.ceil(windowMs / 1000)} s`;
    limiter = new Ratelimit({
      redis: getRedis(),
      prefix: `rl:${prefix}`,
      limiter: Ratelimit.slidingWindow(maxAttempts, windowSec as Parameters<typeof Ratelimit.slidingWindow>[1]),
      analytics: false,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

export async function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
  const prefix = key.split(":")[0] ?? "default";
  const limiter = getLimiter(prefix, maxAttempts, windowMs);

  const { success, remaining, reset } = await limiter.limit(key);

  return {
    allowed: success,
    remaining,
    retryAfterMs: success ? 0 : Math.max(0, reset - Date.now()),
  };
}
