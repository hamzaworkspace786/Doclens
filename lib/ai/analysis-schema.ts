import { z } from "zod";

// The shape the model must answer in. The AI SDK sends this to Gemini as a
// JSON schema and validates the reply against it.
//
// Every field is required (nullable instead of optional) because Gemini follows
// a schema most reliably that way. Size limits are NOT put in the schema:
// lib/ai/analyze.ts trims lists afterwards, so a model that returns 12 key
// points instead of 10 costs two items, not the whole analysis.

// z.number() rather than z.number().int(): a stray 2.5 or a page that doesn't
// exist should cost one citation (cleanPages drops it), not the whole analysis.
const pages = z
  .array(z.number())
  .describe(
    "Whole page numbers, taken from the <page number=...> markers, where this appears. Give one to four pages.",
  );

const entity = (text: string, detail: string) =>
  z.object({
    text: z.string().describe(text),
    detail: z.string().describe(detail),
    pages,
  });

export const analysisSchema = z.object({
  summary: z.object({
    documentType: z
      .string()
      .describe(
        "What kind of document this is, in two to four words. For example: Service contract, Research paper, Invoice, Meeting notes.",
      ),
    overview: z
      .string()
      .describe(
        "A plain summary of three to six sentences for someone who has not read the document: what it is, who it involves, and what it says.",
      ),
    pages,
  }),

  keyPoints: z
    .array(
      z.object({
        point: z.string().describe("The point, as one clear sentence."),
        detail: z
          .string()
          .describe("One or two sentences of supporting detail from the document."),
        pages,
      }),
    )
    .describe("The four to ten most important points, most important first."),

  people: z
    .array(
      entity(
        "The person's name exactly as written in the document.",
        "Their role or what they do in this document. Empty string if the document doesn't say.",
      ),
    )
    .describe("People named in the document who matter to understanding it."),

  organizations: z
    .array(
      entity(
        "The organization's name exactly as written in the document.",
        "What the organization is or does in this document. Empty string if the document doesn't say.",
      ),
    )
    .describe("Companies, institutions and other organizations named in the document."),

  dates: z
    .array(
      entity(
        "The date, deadline or period exactly as written in the document.",
        "What the date refers to.",
      ),
    )
    .describe("Dates, deadlines and time periods that matter in the document."),

  amounts: z
    .array(
      entity(
        "The amount exactly as written in the document, with its currency or unit. Money, percentages, quantities and measurements all count.",
        "What the amount refers to.",
      ),
    )
    .describe("Money, percentages, quantities and measurements that matter in the document."),

  actionItems: z
    .array(
      z.object({
        task: z.string().describe("What needs to be done, as one clear sentence."),
        owner: z
          .string()
          .nullable()
          .describe("Who is responsible. null if the document doesn't say."),
        due: z
          .string()
          .nullable()
          .describe("The deadline as written in the document. null if the document doesn't give one."),
        pages,
      }),
    )
    .describe(
      "Tasks, obligations, deadlines and next steps that someone is expected to act on.",
    ),
});

export type RawAnalysis = z.infer<typeof analysisSchema>;
