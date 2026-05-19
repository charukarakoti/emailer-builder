"use client";

// =============================================================================
// lib/pdfToHtml.ts — convert a PDF file into email-safe HTML on the client.
//
// Approach: render each PDF page to a canvas via pdfjs-dist, export the
// canvas as a PNG data URL, and emit one <img> per page inside a single
// outer <table>. This is the most reliable way to "import a PDF" for an
// email signature/template because:
//   • Layout fidelity is perfect (recipients see exactly what was
//     designed).
//   • No font/styling fragility — Outlook can't break a PNG.
//   • Works in every email client, no JS, no flex/grid.
//
// Downside: the resulting HTML is image-only (no live text). For a true
// text-aware reflow we'd need server-side parsing — out of scope here.
//
// The PDF.js worker is loaded from a CDN to keep the bundle small.
// =============================================================================

const PDFJS_VERSION = "3.11.174";
const WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

export interface PdfToHtmlOptions {
  /** Max width of each page image in CSS pixels. Default 600 (email-safe). */
  maxWidthPx?: number;
  /** Render scale (1 = native, 2 = retina). Default 1.5 for a sharp PNG. */
  scale?: number;
  /** Progress callback — fired as each page finishes. */
  onProgress?: (done: number, total: number) => void;
}

export interface PdfToHtmlResult {
  html: string;
  pageCount: number;
  /** Approximate output byte size. */
  bytes: number;
}

export async function pdfFileToHtml(
  file: File,
  opts: PdfToHtmlOptions = {}
): Promise<PdfToHtmlResult> {
  const maxWidth = opts.maxWidthPx ?? 600;
  const scale = opts.scale ?? 1.5;

  // Lazy import — pdfjs-dist is large and only needed when the user
  // actually imports a PDF.
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_URL;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const total = doc.numPages;

  const pageHtml: string[] = [];
  for (let p = 1; p <= total; p++) {
    const page = await doc.getPage(p);
    const baseViewport = page.getViewport({ scale: 1 });
    // Scale so the rendered PNG matches maxWidth (then displayed at
    // maxWidth via the <img width> attribute; retina-ish quality from
    // `scale`).
    const widthScale = (maxWidth / baseViewport.width) * scale;
    const viewport = page.getViewport({ scale: widthScale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not acquire 2D canvas context");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;

    // JPEG keeps the data URL small; quality 0.85 is visually fine.
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const renderedWidth = Math.round(viewport.width / scale);
    const renderedHeight = Math.round(viewport.height / scale);

    pageHtml.push(
      `<tr><td align="center" style="padding:0 0 12px 0;">` +
        `<img src="${dataUrl}" alt="Page ${p}" width="${renderedWidth}" ` +
        `style="display:block;width:${renderedWidth}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" /></td></tr>`
    );
    opts.onProgress?.(p, total);
  }

  const html = [
    `<!doctype html>`,
    `<html>`,
    `<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="${maxWidth}" style="max-width:${maxWidth}px;margin:0 auto;background:#ffffff;">`,
    pageHtml.join(""),
    `</table>`,
    `</body>`,
    `</html>`,
  ].join("\n");

  return { html, pageCount: total, bytes: new Blob([html]).size };
}
