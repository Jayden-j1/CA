// types/pdfkit.d.ts
//
// Extended local type declarations for PDFKit.
// ------------------------------------------------------------
// Why this file exists:
// PDFKit is distributed as a CommonJS library without bundled TypeScript types.
// These declarations allow full intellisense and compile-time safety
// without requiring deprecated DefinitelyTyped packages.
//
// Coverage includes the most commonly used methods for:
// - Text and fonts
// - Colors and fills
// - Drawing (rectangles, lines, paths)
// - Images and layout
// - Transformations
// - Streams and document lifecycle
//
// ------------------------------------------------------------

declare module "pdfkit" {
  import { Readable } from "stream";

  interface PDFDocumentOptions {
    size?: string | [number, number]; // e.g., 'A4', [595.28, 841.89]
    layout?: "portrait" | "landscape";
    margin?: number;
    info?: {
      Title?: string;
      Author?: string;
      Subject?: string;
      Keywords?: string;
      Creator?: string;
      Producer?: string;
    };
  }

  interface TextOptions {
    align?: "left" | "center" | "right" | "justify";
    width?: number;
    height?: number;
    continued?: boolean;
    underline?: boolean;
    strike?: boolean;
    indent?: number;
    paragraphGap?: number;
    lineGap?: number;
    characterSpacing?: number;
  }

  interface ImageOptions {
    width?: number;
    height?: number;
    scale?: number;
    fit?: [number, number];
    cover?: [number, number];
    align?: "left" | "center" | "right";
    valign?: "top" | "center" | "bottom";
  }

  interface Color {
    r: number;
    g: number;
    b: number;
  }

  class PDFDocument extends Readable {
    constructor(options?: PDFDocumentOptions);

    // ---- Text methods ----
    font(path: string): this;
    fontSize(size: number): this;
    text(
      text: string,
      x?: number | TextOptions,
      y?: number | TextOptions,
      options?: TextOptions
    ): this;
    moveDown(lines?: number): this;
    moveUp(lines?: number): this;

    // ---- Drawing methods ----
    rect(x: number, y: number, width: number, height: number): this;
    roundedRect(
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number
    ): this;
    lineTo(x: number, y: number): this;
    moveTo(x: number, y: number): this;
    stroke(): this;
    fill(): this;
    fillAndStroke(fillColor?: string | Color, strokeColor?: string | Color): this;
    lineWidth(width: number): this;

    // ---- Color + style ----
    fillColor(color: string | Color): this;
    strokeColor(color: string | Color): this;
    opacity(opacity: number): this;
    dash(length?: number, options?: { space?: number; phase?: number }): this;
    undash(): this;

    // ---- Images ----
    image(
      src: string | Buffer,
      x?: number,
      y?: number,
      options?: ImageOptions
    ): this;

    // ---- Transformations ----
    scale(factor: number, options?: { origin?: [number, number] }): this;
    translate(x: number, y: number): this;
    rotate(angle: number, options?: { origin?: [number, number] }): this;

    // ---- Path + clipping ----
    clip(): this;
    save(): this;
    restore(): this;

    // ---- Document lifecycle ----
    addPage(options?: PDFDocumentOptions): this;
    end(): void;

    // ---- Event hooks ----
    on(event: "data", listener: (chunk: Buffer) => void): this;
    on(event: "end", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
  }

  export = PDFDocument;
}
