// app/api/certificate/route.ts
//
// Purpose
// -------
// Generate a Certificate of Completion PDF for the signed-in user and return it
// as a downloadable response.
//
// Why this change?
// ----------------
// TypeScript flagged Buffer → Response because Buffer.buffer is typed as
// ArrayBufferLike (i.e., ArrayBuffer | SharedArrayBuffer). The Fetch Response
// wants a BodyInit that *excludes* SharedArrayBuffer. To avoid this union,
// we COPY the Buffer into a brand-new ArrayBuffer (or Uint8Array view) and
// return that. This guarantees the type is a plain ArrayBuffer, satisfying TS,
// with negligible performance cost for a small PDF.
//
// Guarantees
// ----------
// - No changes to your PDF generation logic (`lib/certificate.ts`)
// - No changes to auth or flows elsewhere
// - Node runtime explicitly set (pdfkit requires Node)
//
// Security:
// - Requires NextAuth session (401 if unauthenticated)

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateCertificatePDF } from "@/lib/certificate";

// PDFKit needs Node (not Edge)
export const runtime = "nodejs";

/** Sanitize a filename for Content-Disposition */
function sanitizeFileName(input: string) {
  return input.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").slice(0, 80);
}

export async function GET(req: Request) {
  // 1) Require authentication
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Inputs (course title from query; user name from session)
  const { searchParams } = new URL(req.url);
  const courseTitle = searchParams.get("courseTitle") || "Course";

  const userName =
    (session.user.name && session.user.name.trim()) ||
    (session.user.email ? session.user.email.split("@")[0] : "Student");

  const completionDate = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  try {
    // 3) Generate PDF into a Node Buffer (no change to your lib)
    const pdfBuffer = await generateCertificatePDF({
      userName,
      courseTitle,
      completionDate,
    });

    // 4) ✅ IMPORTANT: Copy the Buffer into a fresh ArrayBuffer so the type is
    //    *exactly* ArrayBuffer (not ArrayBuffer | SharedArrayBuffer).
    //
    //    - We allocate a new ArrayBuffer and copy bytes via a Uint8Array view.
    //    - This is small (cert PDFs) and avoids all TS type issues.
    const outAb = new ArrayBuffer(pdfBuffer.byteLength);
    new Uint8Array(outAb).set(pdfBuffer); // copies bytes from Buffer → ArrayBuffer

    // 5) Prepare a safe filename
    const filename = `${sanitizeFileName(userName)}_${sanitizeFileName(
      courseTitle
    )}_Certificate.pdf`;

    // 6) Return the ArrayBuffer (valid BodyInit) with download headers
    return new Response(outAb, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // Optional: content length helps some clients
        "Content-Length": String(pdfBuffer.byteLength),
        // Avoid caching personalized files
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[GET /api/certificate] error:", err);
    return NextResponse.json(
      { error: "Failed to generate certificate" },
      { status: 500 }
    );
  }
}
