import { NextResponse } from "next/server";
import { render } from "@react-email/render";
import ResetPasswordEmail from "@/emails/ResetPasswordEmail";

export async function GET(request: Request) {
  // ---------------------------------------------------------
  // 1) Block in production for safety
  // ---------------------------------------------------------
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // ---------------------------------------------------------
  // 2) Allow optional override of the reset URL via ?url=
  // ---------------------------------------------------------
  const { searchParams } = new URL(request.url);
  const previewUrl =
    searchParams.get("url") ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password/preview-token`;

  // ---------------------------------------------------------
  // 3) Render the email component to HTML
  // ---------------------------------------------------------
  // - Some versions of @react-email/render return a Promise<string>
  //   so we `await` to ensure a plain string is passed to NextResponse.
  const html = await render(
    ResetPasswordEmail({
      resetUrl: previewUrl,
      productName: "Cultural Awareness App",
      supportEmail: "support@example.com",
    })
  );

  // ---------------------------------------------------------
  // 4) Return proper HTML content with no-store caching
  // ---------------------------------------------------------
  // - Prevent browsers from caching previews (always render fresh).
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
