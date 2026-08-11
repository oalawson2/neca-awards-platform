/**
 * A minimal, dependency-free PDF writer for fixed, single-page, text-only
 * documents using the 14 standard PDF fonts (Helvetica/Helvetica-Bold
 * here) — no font embedding, no images, no page-splitting. Replaces
 * pdf-lib for the applicant receipt: that receipt is the only thing in
 * this app that ever needed a PDF, and pdf-lib's ~24MB of embedded font
 * data was heavy enough to matter on our memory-capped build host (see
 * the "Reduce number of dependencies" note in Next's own memory-usage
 * guide). This intentionally does not generalize beyond what the receipt
 * needs — it is not a PDF library, it's the smallest thing that produces
 * a valid one.
 *
 * Text is limited to WinAnsiEncoding's range (ASCII plus common Latin-1
 * punctuation/accents — covers everything the receipt template and
 * NECA's applicant data realistically contain). Anything outside that
 * range — a truly non-Latin organisation name, say — falls back to "?"
 * per character: a real constraint of not embedding a font, not a bug.
 */

type FontName = "regular" | "bold";

interface TextOp {
  kind: "text";
  x: number;
  y: number;
  size: number;
  font: FontName;
  color: [number, number, number];
  text: string;
}

interface LineOp {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: [number, number, number];
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89; // A4, points

/** Windows-1252 (WinAnsiEncoding) byte for a Unicode code point, or null if unrepresentable. */
function winAnsiByte(codePoint: number): number | null {
  if (codePoint >= 0x20 && codePoint <= 0x7e) return codePoint; // ASCII
  const special: Record<number, number> = {
    0x2018: 0x91, // left single quote
    0x2019: 0x92, // right single quote / apostrophe
    0x201c: 0x93, // left double quote
    0x201d: 0x94, // right double quote
    0x2013: 0x96, // en dash
    0x2014: 0x97, // em dash
    0x2026: 0x85, // ellipsis
  };
  if (codePoint in special) return special[codePoint];
  if (codePoint >= 0xa0 && codePoint <= 0xff) return codePoint; // Latin-1 supplement, matches WinAnsi here
  return null;
}

/** Encodes text as a PDF literal-string body: WinAnsi bytes, with ( ) \ escaped. Result is a JS string whose char codes are all <= 0xFF, safe to emit via latin1. */
function pdfEscapeString(text: string): string {
  let out = "";
  for (const ch of Array.from(text)) {
    const codePoint = ch.codePointAt(0) ?? 0x3f;
    const byte = winAnsiByte(codePoint) ?? 0x3f; // '?' fallback
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += "\\"; // ( ) \
    out += String.fromCharCode(byte);
  }
  return out;
}

function num(n: number): string {
  // Fixed precision, trimmed of trailing zeros — PDF just needs plain decimals, no scientific notation.
  return (Math.round(n * 1000) / 1000).toString();
}

export class SimplePdfPage {
  private ops: (TextOp | LineOp)[] = [];

  drawText(text: string, opts: { x: number; y: number; size: number; font: FontName; color: [number, number, number] }) {
    this.ops.push({ kind: "text", text, ...opts });
  }

  drawLine(opts: { x1: number; y1: number; x2: number; y2: number; width: number; color: [number, number, number] }) {
    this.ops.push({ kind: "line", ...opts });
  }

  /** Builds the page's content stream body (operators only, no stream/endstream wrapper). */
  toContentStream(): string {
    let cs = "";
    let lastFillColor: string | null = null;
    let lastStrokeColor: string | null = null;
    let lastWidth: number | null = null;

    for (const op of this.ops) {
      if (op.kind === "text") {
        const colorKey = `${op.color[0]},${op.color[1]},${op.color[2]}`;
        if (colorKey !== lastFillColor) {
          cs += `${num(op.color[0])} ${num(op.color[1])} ${num(op.color[2])} rg\n`;
          lastFillColor = colorKey;
        }
        const fontRef = op.font === "bold" ? "/F1" : "/F2";
        cs += `BT ${fontRef} ${num(op.size)} Tf ${num(op.x)} ${num(op.y)} Td (${pdfEscapeString(op.text)}) Tj ET\n`;
      } else {
        const colorKey = `${op.color[0]},${op.color[1]},${op.color[2]}`;
        if (colorKey !== lastStrokeColor) {
          cs += `${num(op.color[0])} ${num(op.color[1])} ${num(op.color[2])} RG\n`;
          lastStrokeColor = colorKey;
        }
        if (op.width !== lastWidth) {
          cs += `${num(op.width)} w\n`;
          lastWidth = op.width;
        }
        cs += `${num(op.x1)} ${num(op.y1)} m ${num(op.x2)} ${num(op.y2)} l S\n`;
      }
    }
    return cs;
  }
}

/** Assembles one A4 page into a complete, valid PDF file (as a Buffer). */
export function renderSimplePdf(page: SimplePdfPage): Buffer {
  const content = page.toContentStream();

  // All strings below only ever contain code points <= 0xFF (PDF syntax
  // is ASCII; text content is pre-encoded via pdfEscapeString), so the
  // JS string's .length is also its byte length once we later encode
  // the whole thing with 'latin1' — that equivalence is what lets us use
  // plain string concatenation to track byte offsets for the xref table.
  let out = "%PDF-1.4\n";
  const offsets: number[] = [0]; // index 0 unused (object numbers start at 1)

  function obj(objNum: number, body: string) {
    offsets[objNum] = out.length;
    out += `${objNum} 0 obj\n${body}\nendobj\n`;
  }

  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(PAGE_WIDTH)} ${num(PAGE_HEIGHT)}] ` +
      `/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`
  );
  obj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  obj(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  offsets[6] = out.length;
  out += `6 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`;

  const xrefOffset = out.length;
  out += `xref\n0 7\n`;
  out += `0000000000 65535 f \n`;
  for (let i = 1; i <= 6; i++) {
    out += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(out, "latin1");
}

export { PAGE_WIDTH, PAGE_HEIGHT };
