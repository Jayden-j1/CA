// app/email-preview/reset/page.tsx
//
// Purpose:
// - Developer-only preview of the Reset Password email.
// - Renders the React Email template to HTML and shows it in the browser.
//
// Safety:
// - Blocks in production by calling notFound().

import { render } from "@react-email/render";
import ResetPasswordEmail from "@/emails/ResetPasswordEmail";
import { notFound } from "next/navigation";

export default async function ResetEmailPreviewPage() {
  // 🚫 Do not expose this in production
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  // Fake token for preview only
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/preview-token`;

  const html = await render(
    ResetPasswordEmail({
      resetUrl,
      productName: "Cultural Awareness App",
      supportEmail: "support@your-domain.com",
    })
  );

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Reset Password Email — Preview</h1>
      <div
        className="prose max-w-none border rounded bg-white p-4"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
