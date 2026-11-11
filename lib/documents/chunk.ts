import { CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS } from "../constants";
import { normalizeText, splitToLimit } from "./text";

export interface Chunk {
  index: number; // position across the whole document, starting at 0
  page: number; // 1-based page the chunk comes from
  text: string;
}

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

// A sentence (or a piece of an overlong sentence), and whether it begins a paragraph.
interface Unit {
  text: string;
  newParagraph: boolean;
}

function toUnits(pageText: string, maxChars: number): Unit[] {
  const units: Unit[] = [];

  for (const paragraph of pageText.split(/\n{2,}/)) {
    // Line breaks inside a paragraph are just wrapping, so treat them as spaces.
    const flat = paragraph.replace(/\s*\n\s*/g, " ").trim();
    if (!flat) continue;

    let first = true;
    for (const sentence of flat.split(/(?<=[.!?…۔؟])\s+/)) {
      for (const piece of splitToLimit(sentence, maxChars)) {
        units.push({ text: piece, newParagraph: first && units.length > 0 });
        first = false;
      }
    }
  }

  return units;
}

function joinUnits(units: Unit[]): string {
  return units
    .map((unit, i) =>
      i === 0 ? unit.text : (unit.newParagraph ? "\n\n" : " ") + unit.text,
    )
    .join("");
}

/**
 * Split pages into overlapping chunks of about `maxChars` characters.
 * Chunks break at sentence boundaries and never cross a page, so each chunk
 * can cite exactly one page.
 */
export function chunkPages(pages: string[], options: ChunkOptions = {}): Chunk[] {
  const maxChars = options.maxChars ?? CHUNK_MAX_CHARS;
  const overlapChars = options.overlapChars ?? CHUNK_OVERLAP_CHARS;
  const chunks: Chunk[] = [];

  pages.forEach((rawPage, pageIndex) => {
    const units = toUnits(normalizeText(rawPage), maxChars);

    let current: Unit[] = [];
    let freshUnits = 0; // units in `current` that are not carried over from the previous chunk

    const flush = () => {
      if (freshUnits === 0) return;
      chunks.push({
        index: chunks.length,
        page: pageIndex + 1,
        text: joinUnits(current),
      });
    };

    for (const unit of units) {
      if (current.length > 0 && joinUnits([...current, unit]).length > maxChars) {
        flush();

        // Start the next chunk with the last few sentences of this one.
        const carry: Unit[] = [];
        for (let i = current.length - 1; i >= 0; i--) {
          const candidate = [current[i], ...carry];
          if (joinUnits(candidate).length > overlapChars) break;
          carry.unshift(current[i]);
        }
        while (carry.length > 0 && joinUnits([...carry, unit]).length > maxChars) {
          carry.shift();
        }

        current = carry;
        freshUnits = 0;
      }

      current.push(unit);
      freshUnits++;
    }

    flush();
  });

  return chunks;
}
