// Turning the model's "[p.8]" markers into page chips. Pure functions, used by
// the browser, so keep server code out of this file.

export type AnswerSegment =
  | { type: "text"; text: string }
  | { type: "cite"; pages: number[] };

// [p.8]  [p. 8]  [P.8]  [p.8, p.12]  [p.8, 12]  [p.8 and p.12]  [p.8; p.12]
const CITATION =
  /\[\s*p\.?\s*(\d{1,5}(?:\s*(?:,|;|&|and)\s*(?:p\.?\s*)?\d{1,5})*)\s*\]/gi;

/**
 * Light cleanup for models that ignore "plain text only": removes bold
 * markers and heading marks and turns "* " bullets into "- " bullets.
 */
export function cleanAnswerText(text: string): string {
  return text
    .replace(/\*\*|__/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*\*\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Splits an answer into plain text and citations. While the answer is still
 * streaming, a half-written marker such as "[p.1" at the very end is held back
 * so it never flashes on screen.
 */
export function splitCitations(text: string, streaming: boolean): AnswerSegment[] {
  const source = streaming ? text.replace(/\[[^\]\n]{0,40}$/, "") : text;
  const segments: AnswerSegment[] = [];
  let last = 0;

  for (const match of source.matchAll(CITATION)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ type: "text", text: source.slice(last, start) });
    const pages = (match[1].match(/\d+/g) ?? []).map(Number);
    segments.push({ type: "cite", pages });
    last = start + match[0].length;
  }
  if (last < source.length) segments.push({ type: "text", text: source.slice(last) });
  return segments;
}

/**
 * The pages of a citation that the model was actually allowed to cite,
 * once each, in order. A page outside `allowed` was made up, so it is dropped.
 */
export function validPages(pages: number[], allowed: number[]): number[] {
  const ok = new Set(allowed);
  return [...new Set(pages)].filter((page) => ok.has(page)).sort((a, b) => a - b);
}
