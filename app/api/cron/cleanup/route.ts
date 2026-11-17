import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { DOCUMENT_RETENTION_DAYS } from "@/lib/constants";
import { deleteExpiredDocuments } from "@/lib/documents/store";

export const maxDuration = 60;

const BATCH = 25;
const MAX_BATCHES = 20; // at most 500 documents per run; the next run continues

// Vercel Cron calls this once a day (see vercel.json) and sends
// "Authorization: Bearer <CRON_SECRET>" when the CRON_SECRET environment
// variable is set. Without the secret, nobody can run it, including us.
function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Deletes documents older than DOCUMENT_RETENTION_DAYS, with their chats and analyses. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - DOCUMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let deleted = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const count = await deleteExpiredDocuments(cutoff, BATCH);
    deleted += count;
    if (count < BATCH) break;
  }

  console.info(`Cleanup deleted ${deleted} documents older than ${DOCUMENT_RETENTION_DAYS} days.`);
  return NextResponse.json({ deleted });
}
