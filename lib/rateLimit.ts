// lib/rateLimit.ts
//
// Purpose:
// - Minimal Upstash Redis rate limiter.
// - Prevents brute-force or abuse on sensitive endpoints (e.g., forgot-password).
//
// Notes:
// - Returns true if within limit, false if rate-limited.
// - Fail-open in case of Redis outage (UX > protection here).

import { Redis } from "@upstash/redis";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export async function limit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    if (!redis) return true;

    const results = await redis
      .multi()
      .incr(key)
      .ttl(key)
      .exec<[number, number]>();

    const count = Number(results?.[0] ?? 0);
    const ttl = Number(results?.[1] ?? -1);

    if (ttl === -1) {
      await redis.expire(key, windowSeconds);
    }

    return count <= max;
  } catch (err) {
    console.warn("[rateLimit] Redis error; allowing request:", err);
    return true;
  }
}
