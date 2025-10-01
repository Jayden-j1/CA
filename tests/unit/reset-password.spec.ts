// tests/unit/reset-password.spec.ts
//
// Purpose:
// - Unit-test reset-password API route.
// - Covers valid reset, expired token, and invalid token paths.

import { POST as resetHandler } from "@/app/api/auth/reset-password/route";

jest.mock("@/lib/prisma", () => {
  return {
    prisma: {
      passwordResetToken: {
        findUnique: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
    },
  };
});

import { prisma } from "@/lib/prisma";

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects weak password", async () => {
    const req = new Request("http://test.local/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token: "t1", password: "weak" }),
    });

    const res = await resetHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/Password must be at least 8/);
  });

  it("rejects missing/invalid token", async () => {
    (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new Request("http://test.local/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        token: "bad",
        password: "Strong1@a",
      }),
    });

    const res = await resetHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/Invalid or already used token/);
  });

  it("rejects expired token", async () => {
    (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
      id: "tr1",
      userId: "u1",
      expires: new Date(Date.now() - 1000), // already expired
    });

    const req = new Request("http://test.local/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        token: "t1",
        password: "Strong1@a",
      }),
    });

    const res = await resetHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/expired/i);
    expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({
      where: { token: "t1" },
    });
  });

  it("accepts valid token and updates password", async () => {
    (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
      id: "tr2",
      userId: "u2",
      expires: new Date(Date.now() + 1000 * 60), // valid
    });

    const req = new Request("http://test.local/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        token: "t2",
        password: "Strong1@a",
      }),
    });

    const res = await resetHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u2" },
      data: expect.objectContaining({ hashedPassword: expect.any(String) }),
    });
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u2" },
    });
  });
});
