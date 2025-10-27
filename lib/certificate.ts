// lib/certificate.ts
//
// ============================================================
// Purpose
// -------
// Generate a clean, printable certificate PDF entirely in memory,
// using PDFKit's *standalone* build so no font metrics are read
// from disk (fixes ENOENT Helvetica.afm on some setups).
//
// Why standalone?
// ---------------
// The regular 'pdfkit' Node build looks up AFM files on disk for
// built-in fonts like Helvetica. In some deployments (serverless,
// Windows paths, bundlers), that path breaks, causing ENOENT.
// The standalone build ships with standard font metrics embedded,
// avoiding any filesystem access.
//
// API Shape
// ---------
// Input : { userName, courseTitle, completionDate }
// Output: Buffer (PDF bytes)
//
// Pillars
// -------
// - Simplicity : one function, returns Buffer
// - Robustness : no FS reads (standalone build), typed handlers
// - Security   : memory-only, no temp files
// - Compatibility : works with Node runtime in Next.js
// ============================================================

/**
 * IMPORTANT: use the standalone build that inlines the standard fonts.
 * This prevents ENOENT for Helvetica.afm and similar issues.
 *
 * We also include a type shim in types/pdfkit-standalone.d.ts so TS
 * understands this import (see file below).
 */
import PDFDocument from "pdfkit/js/pdfkit.standalone.js"; // <-- key change

export async function generateCertificatePDF({
  userName,
  courseTitle,
  completionDate,
}: {
  userName: string;
  courseTitle: string;
  completionDate: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // 1) Create a new PDF document (A4 with comfortable margins).
      //    Standalone build includes standard fonts; no disk access.
      const doc = new PDFDocument({ size: "A4", margin: 50 });

      // 2) Collect bytes emitted by PDFKit; we'll concat when the stream closes.
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("error", (err: unknown) => reject(err));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      // 3) (Optional) explicitly use a standard font. Standalone has metrics inline.
      //    If you later use custom .ttf/.otf files, call doc.registerFont() with a Buffer.
      doc.font("Helvetica");

      // 4) Content — header
      doc
        .fontSize(28)
        .fillColor("#1e3a8a")
        .text("Certificate of Completion", { align: "center" });
      doc.moveDown(2);

      // 5) Recipient name
      doc
        .fontSize(20)
        .fillColor("black")
        .text("This certifies that", { align: "center" });
      doc.moveDown(1);

      doc
        .fontSize(26)
        .fillColor("#0f172a")
        .text(userName, { align: "center", underline: true });
      doc.moveDown(2);

      // 6) Course title
      doc
        .fontSize(18)
        .fillColor("black")
        .text("has successfully completed the course", { align: "center" });
      doc.moveDown(1);

      doc
        .fontSize(22)
        .fillColor("#1e3a8a")
        .text(courseTitle, { align: "center" });
      doc.moveDown(2);

      // 7) Completion date
      doc
        .fontSize(16)
        .fillColor("#475569")
        .text(`Completed on ${completionDate}`, { align: "center" });

      // 8) Footer tagline (brandable)
      doc.moveDown(5);
      doc
        .fontSize(14)
        .fillColor("#1e3a8a")
        .text("Cultural Awareness Program", { align: "center" });
      doc
        .fontSize(12)
        .text("Empowering understanding, respect, and connection.", {
          align: "center",
        });

      // 9) Finalize PDF (flushes data events, then "end" → resolve)
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}









// // lib/certificate.ts
// //
// // ============================================================
// // Phase History
// // ------------------------------------------------------------
// // • Phase 2.3  : First in-memory PDF generation (no disk writes)
// // • Phase 3.x  : Added comments, defensive handlers, type safety
// // • Phase 4.0  : Final polish (import order + docs)
// // ============================================================
// //
// // Purpose
// // -------
// // Generate a clean, printable certificate PDF entirely in memory.
// //
// // API Shape
// // ---------
// // Input : { userName, courseTitle, completionDate }
// // Output: Buffer (PDF bytes) — suitable for `new Response(bytes, { headers })`
// //
// // Pillars
// // -------
// // - Simplicity: single pure function returning a Buffer
// // - Robustness: typed event handlers, try/catch around PDF pipeline
// // - Security: no filesystem writes; operates fully in memory
// // - Compatibility: works with Next.js App Router (Edge requires a WASM lib;
// //                  this implementation targets Node runtime, which is standard)
// //
// // Notes
// // -----
// // If you want to brand the PDF (logo/signature), you can inject an image by
// // passing a Buffer/URL and calling `doc.image(...)` at a chosen position.
// // ============================================================

// import PDFDocument from "pdfkit"; // Requires `@types/pdfkit` (devDependency)

// export async function generateCertificatePDF({
//   userName,
//   courseTitle,
//   completionDate,
// }: {
//   userName: string;
//   courseTitle: string;
//   completionDate: string;
// }): Promise<Buffer> {
//   return new Promise((resolve, reject) => {
//     try {
//       // 1) Create a new PDF document (A4 with comfortable margins)
//       const doc = new PDFDocument({ size: "A4", margin: 50 });

//       // 2) Collect bytes emitted by PDFKit; we'll concat when the stream closes
//       const chunks: Buffer[] = [];
//       doc.on("data", (chunk: Buffer) => chunks.push(chunk));
//       doc.on("error", (err: unknown) => reject(err));
//       doc.on("end", () => resolve(Buffer.concat(chunks)));

//       // 3) Content — header
//       doc
//         .fontSize(28)
//         .fillColor("#1e3a8a")
//         .text("Certificate of Completion", { align: "center" });
//       doc.moveDown(2);

//       // 4) Recipient name
//       doc
//         .fontSize(20)
//         .fillColor("black")
//         .text("This certifies that", { align: "center" });
//       doc.moveDown(1);

//       doc
//         .fontSize(26)
//         .fillColor("#0f172a")
//         .text(userName, { align: "center", underline: true });
//       doc.moveDown(2);

//       // 5) Course title
//       doc
//         .fontSize(18)
//         .fillColor("black")
//         .text("has successfully completed the course", { align: "center" });
//       doc.moveDown(1);

//       doc
//         .fontSize(22)
//         .fillColor("#1e3a8a")
//         .text(courseTitle, { align: "center" });
//       doc.moveDown(2);

//       // 6) Completion date
//       doc
//         .fontSize(16)
//         .fillColor("#475569")
//         .text(`Completed on ${completionDate}`, { align: "center" });

//       // 7) Footer tagline (brandable)
//       doc.moveDown(5);
//       doc
//         .fontSize(14)
//         .fillColor("#1e3a8a")
//         .text("Cultural Awareness Program", { align: "center" });
//       doc
//         .fontSize(12)
//         .text("Empowering understanding, respect, and connection.", {
//           align: "center",
//         });

//       // 8) Finalize PDF (flushes data events, then "end" → resolve)
//       doc.end();
//     } catch (err) {
//       reject(err);
//     }
//   });
// }
