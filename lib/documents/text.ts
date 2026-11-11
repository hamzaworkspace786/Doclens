/** Clean up whitespace without changing the words. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[\t\f\v\u00a0]+/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Cut a long string into pieces of at most `max` characters, breaking at
 * whitespace when there is any reasonably close to the limit.
 */
export function splitToLimit(text: string, max: number): string[] {
  const pieces: string[] = [];
  let rest = text.trim();

  while (rest.length > max) {
    let cut = -1;
    for (let i = max; i >= Math.floor(max * 0.5); i--) {
      if (/\s/.test(rest[i])) {
        cut = i;
        break;
      }
    }
    if (cut === -1) cut = max; // no whitespace nearby (for example Chinese text)

    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) pieces.push(rest);
  return pieces;
}
