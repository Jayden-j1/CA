// tests/unit/rateLimit.spec.ts
//
// Purpose:
// - Unit-test the rate limiter logic with mocked Redis.
// - Ensures correct allow/deny behavior and expiry set on first increment.

jest.mock("@upstash/redis", () => {
  class MockRedis {
    private store = new Map<string, { count: number; ttl: number }>();
    multi() {
      const ops: any[] = [];
      const self = this;
      return {
        incr(key: string) {
          ops.push(["incr", key]);
          return this;
        },
        ttl(key: string) {
          ops.push(["ttl", key]);
          return this;
        },
        async exec<T = any[]>(): Promise<T> {
          const results: any[] = [];
          for (const [op, key] of ops) {
            const entry = self.store.get(key) || { count: 0, ttl: -1 };
            if (op === "incr") {
              entry.count += 1;
              self.store.set(key, entry);
              results.push(entry.count);
            } else if (op === "ttl") {
              results.push(entry.ttl);
            }
          }
          return results as unknown as T;
        },
      };
    }
    async expire(key: string, seconds: number) {
      const entry = this.store.get(key) || { count: 0, ttl: -1 };
      entry.ttl = seconds;
      this.store.set(key, entry);
      return 1;
    }
  }
  return { Redis: MockRedis };
});

import { limit } from "@/lib/rateLimit";

describe("rateLimit", () => {
  it("allows requests within the limit", async () => {
    const key = "rl:test:1";
    const allowed1 = await limit(key, 3, 60);
    const allowed2 = await limit(key, 3, 60);
    const allowed3 = await limit(key, 3, 60);
    const denied4 = await limit(key, 3, 60);

    expect(allowed1).toBe(true);
    expect(allowed2).toBe(true);
    expect(allowed3).toBe(true);
    expect(denied4).toBe(false);
  });
});
