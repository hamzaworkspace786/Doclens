import type { DocumentAnalysis, Entity } from "../types";

// Turns a document's analysis into a Markdown file people can keep, paste into
// Notion or Obsidian, or attach to an email. Pure functions: the route
// (app/api/documents/[id]/export) just calls these.

export interface ExportInput {
  title: string;
  pageCount: number;
  pagesAreEstimated: boolean;
  analysis: DocumentAnalysis;
  model: string;
  generatedAt: string; // ISO date
}

// Names and notes come from a document or a model, so characters that mean
// something in Markdown are escaped. Otherwise a "*" in a name could break the layout.
function esc(text: string) {
  return text.replace(/\s+/g, " ").trim().replace(/([\\`*_{}\[\]<>#|])/g, "\\$1");
}

function pageRefs(pages: number[]) {
  return pages.length > 0 ? ` (${pages.map((page) => `p.${page}`).join(", ")})` : "";
}

function entityLine(item: Entity) {
  const detail = item.detail ? `: ${esc(item.detail)}` : "";
  const warning = item.verified
    ? ""
    : " *(wording not found on the cited page, check it)*";
  return `- **${esc(item.text)}**${detail}${pageRefs(item.pages)}${warning}`;
}

export function analysisToMarkdown(input: ExportInput): string {
  const { analysis } = input;
  const lines: string[] = [];

  lines.push(`# ${esc(input.title)}`, "");
  lines.push(
    `> Analysis by DocLens on ${input.generatedAt.slice(0, 10)}, written by AI (${esc(input.model)}) from the document's text. Check anything important against the cited pages.` +
      (input.pagesAreEstimated
        ? " Page numbers are estimated, because this file has no fixed pages."
        : ""),
    "",
  );

  lines.push("## Summary", "");
  lines.push(`**${esc(analysis.summary.documentType)}**`, "");
  lines.push(`${esc(analysis.summary.overview)}${pageRefs(analysis.summary.pages)}`, "");

  lines.push("## Key points", "");
  if (analysis.keyPoints.length === 0) {
    lines.push("_No key points were found._", "");
  } else {
    analysis.keyPoints.forEach((item, i) => {
      lines.push(`${i + 1}. **${esc(item.point)}**${pageRefs(item.pages)}`);
      if (item.detail) lines.push(`   ${esc(item.detail)}`);
    });
    lines.push("");
  }

  lines.push("## Names and numbers", "");
  const sections: [string, Entity[]][] = [
    ["People", analysis.people],
    ["Organizations", analysis.organizations],
    ["Dates", analysis.dates],
    ["Amounts", analysis.amounts],
  ];
  const filled = sections.filter(([, items]) => items.length > 0);
  if (filled.length === 0) {
    lines.push("_No names, dates, or amounts were found._", "");
  } else {
    for (const [label, items] of filled) {
      lines.push(`### ${label}`, "");
      for (const item of items) lines.push(entityLine(item));
      lines.push("");
    }
  }

  lines.push("## Action items", "");
  if (analysis.actionItems.length === 0) {
    lines.push("_No action items were found._", "");
  } else {
    for (const item of analysis.actionItems) {
      const extras = [
        item.owner ? `Owner: ${esc(item.owner)}` : "",
        item.due ? `Due: ${esc(item.due)}` : "",
      ].filter(Boolean);
      lines.push(
        `- [ ] ${esc(item.task)}${extras.length ? ` — ${extras.join(" · ")}` : ""}${pageRefs(item.pages)}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** A safe download name such as "service-contract-analysis.md". ASCII only, so every browser accepts it. */
export function exportFileName(title: string): string {
  const slug = title
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${slug || "document"}-analysis.md`;
}
