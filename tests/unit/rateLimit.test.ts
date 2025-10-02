// tests/unit/rateLimit.test.ts
//
// Purpose:
// - Unit test of the `limit` helper (lib/rateLimit.ts)
// - When Redis is not configured → allow by default
// - If you want to test real Upstash, you can set env vars and
//   write an integration test separately.

import { limit } from "@/lib/rateLimit";

describe("rateLimit", () => {
  it("returns true when Redis is not configured (dev fallback)", async () => {
    // Ensure no Redis env vars set
    const ok = await limit("rl:test:ip:127.0.0.1", 5, 60);
    expect(ok).toBe(true);
  });
});
