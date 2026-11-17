import { test } from "node:test";
import assert from "node:assert/strict";
import { analysisToMarkdown, exportFileName } from "../lib/documents/export";
import type { DocumentAnalysis } from "../lib/types";

const analysis: DocumentAnalysis = {
  summary: { documentType: "Service contract", overview: "Acme pays *Beta* Ltd.\nIn two parts.", pages: [1, 2] },
  keyPoints: [{ point: "Pay in 30 days", detail: "Late fees of 2% apply.", pages: [8] }, { point: "No detail", detail: "", pages: [] }],
  people: [{ text: "Jane_Smith [CFO]", detail: "CFO", pages: [1], verified: true }],
  organizations: [],
  dates: [{ text: "5 March 2025", detail: "start", pages: [1], verified: false }],
  amounts: [{ text: "$12,000", detail: "", pages: [], verified: true }],
  actionItems: [
    { task: "Send the report", owner: "Ali", due: "30 June 2025", pages: [2, 3] },
    { task: "Follow up", owner: null, due: null, pages: [] },
  ],
};
const base = { title: "Contract #1 (final).pdf", pageCount: 12, pagesAreEstimated: false, analysis, model: "gemini-3.5-flash-lite", generatedAt: "2026-11-14T10:00:00.000Z" };

test("export: structure, citations, warnings, escapes", () => {
  const md = analysisToMarkdown(base);
  assert.match(md, /^# Contract \\#1 \(final\)\.pdf\n/);
  assert.match(md, /Analysis by DocLens on 2026-11-14, written by AI \(gemini-3\.5-flash-lite\)/);
  assert.match(md, /\*\*Service contract\*\*/);
  assert.match(md, /Acme pays \\\*Beta\\\* Ltd\. In two parts\. \(p\.1, p\.2\)/);   // newline flattened, * escaped
  assert.match(md, /1\. \*\*Pay in 30 days\*\* \(p\.8\)\n   Late fees of 2% apply\./);
  assert.match(md, /2\. \*\*No detail\*\*\n/);
  assert.match(md, /### People\n\n- \*\*Jane\\_Smith \\\[CFO\\\]\*\*: CFO \(p\.1\)/);
  assert.doesNotMatch(md, /### Organizations/);                                       // empty sections omitted
  assert.match(md, /- \*\*5 March 2025\*\*: start \(p\.1\) \*\(wording not found on the cited page, check it\)\*/);
  assert.match(md, /- \*\*\$12,000\*\*\n/);                                           // no page, no detail, verified
  assert.match(md, /- \[ \] Send the report — Owner: Ali · Due: 30 June 2025 \(p\.2, p\.3\)/);
  assert.match(md, /- \[ \] Follow up\n/);
  assert.ok(md.endsWith("\n") && !md.endsWith("\n\n"));
  assert.doesNotMatch(md, /\n{3,}/);
});

test("export: estimated pages note; empty analysis gives readable placeholders", () => {
  assert.match(analysisToMarkdown({ ...base, pagesAreEstimated: true }), /Page numbers are estimated/);
  const empty: DocumentAnalysis = { summary: { documentType: "Document", overview: "Short.", pages: [] }, keyPoints: [], people: [], organizations: [], dates: [], amounts: [], actionItems: [] };
  const md = analysisToMarkdown({ ...base, analysis: empty });
  for (const s of ["No key points were found", "No names, dates, or amounts were found", "No action items were found"]) assert.match(md, new RegExp(s));
});

test("exportFileName: ascii, safe, bounded", () => {
  assert.equal(exportFileName("Service Contract (final).pdf"), "service-contract-final-analysis.md");
  assert.equal(exportFileName("اردو.docx"), "document-analysis.md");
  assert.equal(exportFileName("Résumé 2026.txt"), "resume-2026-analysis.md");
  assert.equal(exportFileName("../../etc/passwd"), "etc-passwd-analysis.md");
  assert.equal(exportFileName("a\"b\r\nc.pdf"), "a-bc-analysis.md"); // line breaks removed: no header injection
  assert.ok(exportFileName("x".repeat(300) + ".pdf").length <= 60 + "-analysis.md".length);
  assert.equal(exportFileName(""), "document-analysis.md");
});
