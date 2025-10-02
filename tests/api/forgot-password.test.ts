// tests/api/forgot-password.test.ts
//
// Purpose:
// - Unit test for POST /api/auth/forgot-password
// - Verifies silent success when user not found.
// - Verifies token creation + email sending when user exists.
// - Mocks Prisma + sendResetPasswordEmail.

import { NextResponse } from "next/server";

// Mock prisma + email helpers
jest.mock("@/lib/prisma", () => ({
  prisma: require("../../__mocks__/prisma").prisma,
}));
jest.mock("@/lib/email/resendClient", () => ({
  sendResetPasswordEmail: require("../../__mocks__/email").sendResetPasswordEmail,
}));

import { prisma } from "@/lib/prisma";
import { sendResetPasswordEmail } from "@/lib/email/resendClient";
import { POST as forgotHandler } from "@/app/api/auth/forgot-password/route";

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when email is missing", async () => {
    const req = new Request("http://localhost/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = (await forgotHandler(req)) as NextResponse;
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Email is required");
  });

  it("returns ok when user not found (silent success)", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "missing@example.com" }),
    });

    const res = (await forgotHandler(req)) as NextResponse;
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(sendResetPasswordEmail).not.toHaveBeenCalled();
  });

  it("creates token + sends email for active user", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      isActive: true,
    });

    (prisma.passwordResetToken.create as jest.Mock).mockResolvedValue({
      id: "prt_1",
      token: "abc",
      userId: "user_1",
      expiresAt: new Date(Date.now() + 3600_000),
      createdAt: new Date(),
    });

    const req = new Request("http://localhost/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const res = (await forgotHandler(req)) as NextResponse;
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);

    expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
    expect(sendResetPasswordEmail).toHaveBeenCalledTimes(1);
    expect((sendResetPasswordEmail as jest.Mock).mock.calls[0][0]).toHaveProperty(
      "to",
      "user@example.com"
    );
  });
});
