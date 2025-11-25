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
// avoiding any filesystem access for fonts.
//
// API Shape
// ---------
// Input : { userName, courseTitle, completionDate }
//         - completionDate: if passed as a non-empty string, it is used as-is.
//         - if an empty/blank string is passed, we fall back to "today"
//           when generating the PDF.
// Output: Buffer (PDF bytes)
//
// Visual notes
// ------------
// - Very light, professional grey background behind the whole page.
// - Deep blue border inset from the edges.
// - If callers still pass "Cultural Awareness Training" as the courseTitle,
//   we render "Nyangbul Cultural Awareness Training" on the certificate
//   without changing any other files.
//
// Pillars
// -------
// - Simplicity    : one function, returns Buffer
// - Robustness    : no FS reads for fonts (standalone build), typed handlers
// - Security      : memory-only, no temp files
// - Compatibility : works with Node runtime in Next.js
// - Visual polish : subtle grey background + blue border
// ============================================================

/**
 * IMPORTANT: use the standalone build that inlines the standard fonts.
 * This prevents ENOENT for Helvetica.afm and similar issues.
 *
 * We also include a type shim in types/pdfkit-standalone.d.ts so TS
 * understands this import.
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
      //    Standalone build includes standard fonts; no disk access for font metrics.
      const doc = new PDFDocument({ size: "A4", margin: 50 });

      // 2) Collect bytes emitted by PDFKit; we'll concat when the stream closes.
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("error", (err: unknown) => reject(err));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      // ------------------------------------------------------------
      // 3) Page-level helpers: dimensions, subtle grey background,
      //    and deep blue border.
      // ------------------------------------------------------------

      // 3a) Capture current page dimensions for layout helpers (border, background).
      //
      // PDFKit *does* expose `page` at runtime, but the TypeScript typings for the
      // standalone build often do not include it. To keep TS happy while still
      // using the real runtime API, we:
      //   - cast `doc` to `any`
      //   - then read `.page` off that value
      //
      // This keeps the implementation correct without fighting the type definitions.
      const page = (doc as any).page;
      const width: number = page.width;
      const height: number = page.height;

      // 3b) Very light, professional grey background.
      //
      // We fill a rectangle over the entire page with a subtle grey tone.
      // Using save()/restore() ensures subsequent drawing (border + text)
      // are unaffected by the fill color.
      doc
        .save()
        .rect(0, 0, width, height)
        .fillColor("#f5f5f5") // set fill color
        .fill() // apply fill
        .restore();

      // 3c) Deep blue border around the edge of the certificate.
      //
      // We draw a rectangle inset slightly from the page edges so it doesn't get
      // cut off by printers. Again, save()/restore() ensures line styles don't
      // leak into text.
      doc
        .save() // Save current graphics state (colors, line width, etc.)
        .lineWidth(6) // Border thickness
        .strokeColor("#1e3a8a") // Deep blue (Tailwind-like 'blue-900')
        .rect(15, 15, width - 30, height - 30) // x, y, w, h — inset 15 units from each side
        .stroke()
        .restore(); // Restore previous state so text colors/fonts remain as intended

      // ------------------------------------------------------------
      // 4) Compute "effective" completion date
      // ------------------------------------------------------------
      //
      // We want the certificate to always show a sensible completion date:
      // - If the caller passes a non-empty string (e.g. from DB), we trust it.
      // - If the caller passes an empty/blank string, we fall back to "today".
      //
      // This means you don't *have* to pre-format the date in the caller.
      const effectiveCompletionDate =
        typeof completionDate === "string" && completionDate.trim().length > 0
          ? completionDate
          : new Date().toLocaleDateString("en-AU", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            });

      // ------------------------------------------------------------
      // 5) Normalise course title for Nyangbul naming
      // ------------------------------------------------------------
      //
      // To avoid touching other files, we gently "upgrade" any old course
      // title `"Cultural Awareness Training"` to:
      //   "Nyangbul Cultural Awareness Training"
      //
      // Any other incoming title is used as-is.
      const trimmedTitle = courseTitle.trim();
      const normalisedCourseTitle =
        trimmedTitle === "Cultural Awareness Training"
          ? "Nyangbul Cultural Awareness Training"
          : trimmedTitle;

      // 6) (Optional) explicitly use a standard font. Standalone has metrics inline.
      //    If you later use custom .ttf/.otf files, call doc.registerFont() with a Buffer.
      doc.font("Helvetica");

      // 7) Content — header
      doc
        .fontSize(28)
        .fillColor("#1e3a8a")
        .text("Certificate of Completion", { align: "center" });
      doc.moveDown(2);

      // 8) Recipient name block
      doc
        .fontSize(20)
        .fillColor("black")
        .text("This certifies that", { align: "center" });
      doc.moveDown(1);

      doc
        .fontSize(26)
        .fillColor("#0f172a")
        .text(userName, { align: "center", underline: false });
      doc.moveDown(2);

      // 9) Course title and description
      doc
        .fontSize(18)
        .fillColor("black")
        .text("has successfully completed the course", { align: "center" });
      doc.moveDown(1);

      doc
        .fontSize(22)
        .fillColor("#1e3a8a")
        .text(normalisedCourseTitle, { align: "center" });
      doc.moveDown(2);

      // 10) Completion date line
      //
      // Uses the "effectiveCompletionDate" computed above, which is either:
      // - the caller-provided string, or
      // - a nicely formatted "today" date if the string was blank.
      doc
        .fontSize(16)
        .fillColor("#475569")
        .text(`Completed on ${effectiveCompletionDate}`, { align: "center" });

      // 11) Footer tagline (brandable)
      doc.moveDown(5);
      doc
        .fontSize(14)
        .fillColor("#1e3a8a")
        .text("Gangga Nuhma - To learn and understand", { align: "center" });
      doc
        .fontSize(12)
        .text("Bugalbeh (Thank you).", {
          align: "center",
        });

      // 12) Finalize PDF (flushes data events, then "end" → resolve)
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}









// // lib/certificate.ts
// //
// // ============================================================
// // Purpose
// // -------
// // Generate a clean, printable certificate PDF entirely in memory,
// // using PDFKit's *standalone* build so no font metrics are read
// // from disk (fixes ENOENT Helvetica.afm on some setups).
// //
// // Why standalone?
// // ---------------
// // The regular 'pdfkit' Node build looks up AFM files on disk for
// // built-in fonts like Helvetica. In some deployments (serverless,
// // Windows paths, bundlers), that path breaks, causing ENOENT.
// // The standalone build ships with standard font metrics embedded,
// // avoiding any filesystem access for fonts.
// //
// // API Shape
// // ---------
// // Input : { userName, courseTitle, completionDate }
// //         - completionDate: if passed as a non-empty string, it is used as-is.
// //         - if an empty/blank string is passed, we fall back to "today"
// //           when generating the PDF.
// // Output: Buffer (PDF bytes)
// //
// // Pillars
// // -------
// // - Simplicity    : one function, returns Buffer
// // - Robustness    : no FS reads for fonts (standalone build), typed handlers
// // - Security      : memory-only, no temp files
// // - Compatibility : works with Node runtime in Next.js
// // - Visual polish : optional background image support + blue border
// // ============================================================

// /**
//  * IMPORTANT: use the standalone build that inlines the standard fonts.
//  * This prevents ENOENT for Helvetica.afm and similar issues.
//  *
//  * We also include a type shim in types/pdfkit-standalone.d.ts so TS
//  * understands this import.
//  */
// import PDFDocument from "pdfkit/js/pdfkit.standalone.js"; // <-- key change

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
//       // 1) Create a new PDF document (A4 with comfortable margins).
//       //    Standalone build includes standard fonts; no disk access for font metrics.
//       const doc = new PDFDocument({ size: "A4", margin: 50 });

//       // 2) Collect bytes emitted by PDFKit; we'll concat when the stream closes.
//       const chunks: Buffer[] = [];
//       doc.on("data", (chunk: Buffer) => chunks.push(chunk));
//       doc.on("error", (err: unknown) => reject(err));
//       doc.on("end", () => resolve(Buffer.concat(chunks)));

//       // ------------------------------------------------------------
//       // 3) Page-level helpers: dimensions, optional background image,
//       //    and deep blue border.
//       // ------------------------------------------------------------

//       // 3a) Capture current page dimensions for layout helpers (border, background).
//       //
//       // PDFKit *does* expose `page` at runtime, but the TypeScript typings for the
//       // standalone build often do not include it. To keep TS happy while still
//       // using the real runtime API, we:
//       //   - cast `doc` to `any`
//       //   - then read `.page` off that value
//       //
//       // This keeps the implementation correct without fighting the type definitions.
//       const page = (doc as any).page;
//       const width: number = page.width;
//       const height: number = page.height;

//       doc
//         .save() // Save current graphics state (colors, line width, etc.)
//         .lineWidth(6) // Border thickness
//         .strokeColor("#1e3a8a") // Deep blue (Tailwind-like 'blue-900')
//         .rect(15, 15, width - 30, height - 30) // x, y, w, h — inset 15 units from each side
//         .stroke()
//         .restore(); // Restore previous state so text colors/fonts remain as intended

//       // ------------------------------------------------------------
//       // 4) Compute "effective" completion date
//       // ------------------------------------------------------------
//       //
//       // We want the certificate to always show a sensible completion date:
//       // - If the caller passes a non-empty string (e.g. from DB), we trust it.
//       // - If the caller passes an empty/blank string, we fall back to "today".
//       //
//       // This means you don't *have* to pre-format the date in the caller.
//       const effectiveCompletionDate =
//         typeof completionDate === "string" && completionDate.trim().length > 0
//           ? completionDate
//           : new Date().toLocaleDateString("en-AU", {
//               day: "2-digit",
//               month: "long",
//               year: "numeric",
//             });

//       // 5) (Optional) explicitly use a standard font. Standalone has metrics inline.
//       //    If you later use custom .ttf/.otf files, call doc.registerFont() with a Buffer.
//       doc.font("Helvetica");

//       // 6) Content — header
//       doc
//         .fontSize(28)
//         .fillColor("#1e3a8a")
//         .text("Certificate of Completion", { align: "center" });
//       doc.moveDown(2);

//       // 7) Recipient name block
//       doc
//         .fontSize(20)
//         .fillColor("black")
//         .text("This certifies that", { align: "center" });
//       doc.moveDown(1);

//       doc
//         .fontSize(26)
//         .fillColor("#0f172a")
//         .text(userName, { align: "center", underline: false });
//       doc.moveDown(2);

//       // 8) Course title and description
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

//       // 9) Completion date line
//       //
//       // Uses the "effectiveCompletionDate" computed above, which is either:
//       // - the caller-provided string, or
//       // - a nicely formatted "today" date if the string was blank.
//       doc
//         .fontSize(16)
//         .fillColor("#475569")
//         .text(`Completed on ${effectiveCompletionDate}`, { align: "center" });

//       // 10) Footer tagline (brandable)
//       doc.moveDown(5);
//       doc
//         .fontSize(14)
//         .fillColor("#1e3a8a")
//         .text("Nyangbul Cultural Awareness Program", { align: "center" });
//       doc
//         .fontSize(12)
//         .text("Booglebeh (Thank you).", {
//           align: "center",
//         });

//       // 11) Finalize PDF (flushes data events, then "end" → resolve)
//       doc.end();
//     } catch (err) {
//       reject(err);
//     }
//   });
// }








