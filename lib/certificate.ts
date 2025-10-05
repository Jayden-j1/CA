// lib/certificate.ts
//
// Purpose:
// - Generate a clean, printable certificate PDF entirely in-memory.
// - Input: user's name, course title, and completion date.
// - Output: a Buffer of PDF bytes (returned via API).
//
// Pillars:
// - Simplicity: single pure function.
// - Robustness: typed event handlers and error handling.
// - Security: no disk writes; operates fully in memory.
// - Compatibility: works seamlessly with Next.js App Router.

import PDFDocument from "pdfkit"; // ✅ Modern ESM-compatible import

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
      // Create a new PDF document in-memory
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      // Collect binary chunks of the PDF as it's generated
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("error", (err: unknown) => reject(err));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      // --- Header ---
      doc.fontSize(28).fillColor("#1e3a8a").text("Certificate of Completion", {
        align: "center",
      });
      doc.moveDown(2);

      // --- Recipient ---
      doc.fontSize(20).fillColor("black").text("This certifies that", {
        align: "center",
      });
      doc.moveDown(1);
      doc.fontSize(26).fillColor("#0f172a").text(userName, {
        align: "center",
        underline: true,
      });
      doc.moveDown(2);

      // --- Course Info ---
      doc
        .fontSize(18)
        .fillColor("black")
        .text("has successfully completed the course", { align: "center" });
      doc.moveDown(1);
      doc.fontSize(22).fillColor("#1e3a8a").text(courseTitle, {
        align: "center",
      });
      doc.moveDown(2);

      // --- Date ---
      doc
        .fontSize(16)
        .fillColor("#475569")
        .text(`Completed on ${completionDate}`, { align: "center" });

      // --- Footer ---
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

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
