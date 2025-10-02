// tests/api/reset-password.test.ts
//
// Purpose:
// - Unit test for POST /api/auth/reset-password
// - Verifies expired/invalid token handling
// - Verifies successful password update + token deletion
//
// NOTE: These tests mock prisma only. They assume your route has
// a handler exported as `POST` under the path below. Adjust import
// if your file structure differs.

jest.mock("@/lib/prisma", () => ({
  prisma: require("../../__mocks__/prisma").prisma,
}));

import { prisma } from "@/lib/prisma";
import { POST as resetHandler } from "@/app/api/auth/reset-password/route";
import { NextResponse } from "next/server";

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 if missing token/password", async () => {
    const req = new Request("http://localhost/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = (await resetHandler(req)) as NextResponse;
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBeTruthy();
  });

  it("returns 400 for invalid/expired token", async () => {
    (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token: "bad", password: "Strong@123" }),
    });
    const res = (await resetHandler(req)) as NextResponse;
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid|expired/i);
  });

  it("updates password + deletes token for valid token", async () => {
    (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
      id: "prt_1",
      token: "good",
      userId: "user_1",
      expiresAt: new Date(Date.now() + 3600_000),
      createdAt: new Date(),
    });

    (prisma.user.update as jest.Mock) = jest.fn().mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
    });

    (prisma.passwordResetToken.delete as jest.Mock) = jest
      .fn()
      .mockResolvedValue({});

    const req = new Request("http://localhost/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token: "good", password: "Strong@123" }),
    });
    const res = (await resetHandler(req)) as NextResponse;
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.passwordResetToken.delete).toHaveBeenCalledTimes(1);
  });
});
