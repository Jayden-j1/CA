// lib/rateLimit.ts
//
// Purpose:
// - Simple rate limiter using Upstash Redis (serverless).
// - Prevents abuse of sensitive endpoints (e.g., forgot-password).
//
// Fixes:
// - Cast Redis results to numbers (`Number(...)`) before comparing.
//   Upstash returns strings, which caused type mismatches.
//
// Usage:
//   const okIp = await limit(`rl:fp:ip:${ip}`, 5, 60);
//   if (!okIp) return NextResponse.json({ ok: true });

import { Redis } from "@upstash/redis";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/**
 * limit
 * - Increments counter for a given key with expiry.
 * - Returns true if count <= max (within window), else false.
 */
export async function limit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    if (!redis) return true; // allow if no Redis configured

    // Increment counter & get TTL atomically
    const results = await redis
      .multi()
      .incr(key)
      .ttl(key)
      .exec<[number, number]>();

    const count = Number(results?.[0] ?? 0);
    const ttl = Number(results?.[1] ?? -1);

    // If no TTL set, expire in `windowSeconds`
    if (ttl === -1) {
      await redis.expire(key, windowSeconds);
    }

    return count <= max;
  } catch (err) {
    console.warn("[rateLimit] Redis error, allowing request:", err);
    return true; // fail-open
  }
}
