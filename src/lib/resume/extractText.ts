// Turns an uploaded file into plain text, in the browser. The file is never uploaded:
// pdf.js and mammoth both run locally.

export const LIMITS = {
  /** 5 MB. A text resume is far smaller; anything larger is usually a scan or a portfolio. */
  maxBytes: 5 * 1024 * 1024,
  /** Resumes run one to three pages. Ten leaves room for a long CV. */
  maxPages: 10,
  /** Fewer readable characters than this means there is no text layer worth reading. */
  minChars: 200,
  /** Pasted or extracted text is cut here. */
  maxChars: 60_000,
} as const;

export type ResumeErrorKind = "unsupported" | "oversized" | "unreadable" | "scanned" | "too_long" | "empty";

export class ResumeError extends Error {
  constructor(public kind: ResumeErrorKind) {
    super(RESUME_ERROR_TEXT[kind]);
  }
}

/** What to tell the person, and what they can do about it. */
export const RESUME_ERROR_TEXT: Record<ResumeErrorKind, string> = {
  unsupported: "That file type is not supported. Upload a PDF or a Word .docx file, or paste the text of your resume.",
  oversized: "That file is larger than 5 MB. Export a smaller PDF, or paste the text of your resume.",
  unreadable: "We could not open that file. It may be damaged or password protected. Try exporting it again, or paste the text.",
  scanned: "This looks like a scanned image, so there is no text to read. Upload the original file you exported from Word or Google Docs, or paste the text.",
  too_long: "That file has more than 10 pages. Upload just your resume, or paste the text.",
  empty: "There is not enough text here to read. Paste your whole resume.",
};

export type FileKind = "pdf" | "docx";

export function kindOf(name: string, type: string): FileKind | null {
  const n = name.toLowerCase();
  if (type === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || n.endsWith(".docx")) return "docx";
  return null;
}

export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[​‌‍﻿]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, LIMITS.maxChars);
}

interface PdfItem {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
}
interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<{ getTextContent(): Promise<{ items: PdfItem[] }> }>;
  destroy?: () => Promise<void> | void;
}
export interface PdfLib {
  getDocument(src: { data: Uint8Array }): { promise: Promise<PdfDoc> };
}

/** Rebuilds lines from pdf.js text items using their vertical position. */
export async function pdfToText(lib: PdfLib, data: Uint8Array): Promise<string> {
  let doc: PdfDoc;
  try {
    doc = await lib.getDocument({ data }).promise;
  } catch {
    throw new ResumeError("unreadable");
  }
  try {
    if (doc.numPages > LIMITS.maxPages) throw new ResumeError("too_long");
    const pages: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const { items } = await (await doc.getPage(p)).getTextContent();
      let line = "";
      let lastY: number | null = null;
      const lines: string[] = [];
      for (const it of items) {
        if (typeof it.str !== "string") continue;
        const y = it.transform?.[5] ?? null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && line.trim()) {
          lines.push(line);
          line = "";
        }
        line += it.str;
        if (it.hasEOL) {
          lines.push(line);
          line = "";
        }
        if (y !== null && it.str.trim()) lastY = y;
      }
      if (line.trim()) lines.push(line);
      pages.push(lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n"));
    }
    return pages.join("\n\n");
  } finally {
    await doc.destroy?.();
  }
}

export interface DocxLib {
  extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
}

export async function docxToText(lib: DocxLib, data: ArrayBuffer): Promise<string> {
  try {
    return (await lib.extractRawText({ arrayBuffer: data })).value;
  } catch {
    throw new ResumeError("unreadable");
  }
}

export interface Parsers {
  pdf: () => Promise<PdfLib>;
  docx: () => Promise<DocxLib>;
}

/** Validates the file, extracts its text and checks there is enough of it. */
export async function fileToText(file: { name: string; type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }, parsers: Parsers): Promise<string> {
  const kind = kindOf(file.name, file.type);
  if (!kind) throw new ResumeError("unsupported");
  if (file.size > LIMITS.maxBytes) throw new ResumeError("oversized");
  if (file.size === 0) throw new ResumeError("unreadable");
  const buf = await file.arrayBuffer();
  const raw = kind === "pdf" ? await pdfToText(await parsers.pdf(), new Uint8Array(buf)) : await docxToText(await parsers.docx(), buf);
  const text = cleanText(raw);
  if (text.replace(/\s/g, "").length < LIMITS.minChars) throw new ResumeError(kind === "pdf" ? "scanned" : "empty");
  return text;
}

export function pastedToText(raw: string): string {
  const text = cleanText(raw);
  if (text.replace(/\s/g, "").length < LIMITS.minChars) throw new ResumeError("empty");
  return text;
}

/** Loads the parsers only when someone uploads a file. Browser only. */
export const browserParsers: Parsers = {
  pdf: async () => {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return pdfjs as unknown as PdfLib;
  },
  docx: async () => {
    const mod = await import("mammoth/mammoth.browser");
    return ((mod as { default?: DocxLib }).default ?? mod) as unknown as DocxLib;
  },
};
