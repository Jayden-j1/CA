// tests/unit/forgot-password.spec.ts
//
// Purpose:
// - Unit-test forgot-password API route.
// - Ensures token is created with `expires` (schema aligned).
// - Verifies that non-existing users still get { ok: true } without side effects.

import { POST as forgotPasswordHandler } from "@/app/api/auth/forgot-password/route";

jest.mock("@/lib/prisma", () => {
  return {
    prisma: {
      user: {
        findUnique: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
      },
    },
  };
});

jest.mock("@/lib/email/resendClient", () => {
  return {
    sendResetPasswordEmail: jest.fn().mockResolvedValue(undefined),
  };
});

import { prisma } from "@/lib/prisma";
import { sendResetPasswordEmail } from "@/lib/email/resendClient";

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates token (with expires) and emails user", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "u1",
      isActive: true,
      email: "user@example.com",
    });

    const req = new Request("http://test.local/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
    });

    const res = await forgotPasswordHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);

    expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    const args = (prisma.passwordResetToken.create as jest.Mock).mock.calls[0][0];
    expect(args.data).toHaveProperty("token");
    expect(args.data).toHaveProperty("userId", "u1");
    expect(args.data).toHaveProperty("expires");
    expect(args.data.expires instanceof Date).toBe(true);

    expect(sendResetPasswordEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" })
    );
  });

  it("returns ok without side-effects for non-existing user", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new Request("http://test.local/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "ghost@example.com" }),
    });

    const res = await forgotPasswordHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(sendResetPasswordEmail).not.toHaveBeenCalled();
  });
});
