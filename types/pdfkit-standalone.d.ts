// types/pdfkit-standalone.d.ts
//
// Purpose
// -------
// Provide a minimal ambient declaration so importing
// "pdfkit/js/pdfkit.standalone.js" works with TypeScript.
//
// We map it to the same shape as our local pdfkit.d.ts class.

declare module "pdfkit/js/pdfkit.standalone.js" {
  import type PDFDocumentType from "pdfkit"; // reuse the class shape we declared
  const PDFDocument: typeof PDFDocumentType;
  export default PDFDocument;
}
