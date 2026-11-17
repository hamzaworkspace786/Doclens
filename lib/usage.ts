import "server-only";
import { LIMITS } from "@/lib/constants";
import { db } from "@/lib/mongodb";

// Fair-use limits. Every upload, question and re-analysis calls the AI, which
// runs on free quotas, so each one is counted per person and for the whole site.
//
// A counter is one small record per (who, what, time window). Counting is done
// with a single database update, so two requests arriving at the same moment
// can never both slip past a limit. Old counters delete themselves (TTL index).

export type Action = "upload" | "question" | "reanalysis";
type Windows = "minute" | "hour" | "day";

interface Rule {
  scope: "user" | "site";
  window: Windows;
  limit: number;
  /** What the person is told when this limit is reached. */
  message: string;
}

const SITE_BUSY =
  "DocLens is very busy today and has used up its free daily AI allowance. Please try again tomorrow.";
const resets = (window: Windows) =>
  window === "day" ? "It resets at midnight UTC." : window === "hour" ? "Try again within the hour." : "Wait a minute and try again.";

const RULES: Record<Action, Rule[]> = {
  upload: [
    { scope: "user", window: "hour", limit: LIMITS.uploadsPerHour, message: `You can upload ${LIMITS.uploadsPerHour} documents per hour. ${resets("hour")}` },
    { scope: "user", window: "day", limit: LIMITS.uploadsPerDay, message: `You can upload ${LIMITS.uploadsPerDay} documents per day. ${resets("day")}` },
    { scope: "site", window: "day", limit: LIMITS.siteUploadsPerDay, message: SITE_BUSY },
  ],
  question: [
    { scope: "user", window: "minute", limit: LIMITS.questionsPerMinute, message: `You're asking questions very fast. ${resets("minute")}` },
    { scope: "user", window: "day", limit: LIMITS.questionsPerDay, message: `You've reached today's limit of ${LIMITS.questionsPerDay} questions. ${resets("day")}` },
    { scope: "site", window: "day", limit: LIMITS.siteQuestionsPerDay, message: SITE_BUSY },
  ],
  reanalysis: [
    { scope: "user", window: "day", limit: LIMITS.reanalysesPerDay, message: `You can re-run the analysis ${LIMITS.reanalysesPerDay} times per day. ${resets("day")}` },
    { scope: "site", window: "day", limit: LIMITS.siteReanalysesPerDay, message: SITE_BUSY },
  ],
};

interface Counter {
  userId: string; // a user id, or SITE for the site-wide counter
  kind: Action;
  bucket: string; // the minute, hour or day this count belongs to
  count: number;
  expiresAt: Date;
}

const SITE = "__site__";
const counters = () => db.collection<Counter>("usage");

let indexesReady: Promise<unknown> | null = null;
function ensureIndexes() {
  indexesReady ??= Promise.all([
    counters().createIndex({ userId: 1, kind: 1, bucket: 1 }, { unique: true }),
    counters().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]).catch((error) => {
    indexesReady = null;
    throw error;
  });
  return indexesReady;
}

const SECONDS = { minute: 60, hour: 3600, day: 86400 } as const;
const BUCKET_LENGTH = { minute: 16, hour: 13, day: 10 } as const; // characters of the ISO date

/** "2026-11-15T10:23" for a minute, "2026-11-15T10" for an hour, "2026-11-15" for a day. */
export function bucketFor(window: Windows, now: Date) {
  return now.toISOString().slice(0, BUCKET_LENGTH[window]);
}

/** Seconds until the current window ends, at least 1. */
export function secondsLeft(window: Windows, now: Date) {
  const length = SECONDS[window];
  const into = Math.floor(now.getTime() / 1000) % length;
  return Math.max(1, length - into);
}

/** Add one to a counter unless it has reached its limit. Returns whether it was added. */
async function take(userId: string, kind: Action, rule: Rule, now: Date): Promise<boolean> {
  const bucket = bucketFor(rule.window, now);
  const expiresAt = new Date(now.getTime() + (SECONDS[rule.window] + 3600) * 1000);

  // The filter only matches a counter that is still under its limit. If the
  // counter exists and is full, nothing matches, the upsert tries to create a
  // second one, and the unique index refuses with error 11000: that means "full".
  // The same error also happens when two first requests create the counter
  // together, so one retry tells the two cases apart.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await counters().updateOne(
        { userId, kind, bucket, count: { $lt: rule.limit } },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
        { upsert: true },
      );
      return true;
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
  return false;
}

export type UsageResult =
  | { ok: true }
  | { ok: false; message: string; retryAfterSeconds: number };

/**
 * Count one use of an AI feature for this person and for the site. Call it
 * after the cheap checks (sign-in, file type, a valid question) and before
 * the AI is called. When a limit is reached it says which one, in words fit
 * to show the person.
 *
 * A use that later fails still counts, which keeps this simple and fair to the
 * free quota the failed call may have used.
 */
export async function consume(
  userId: string,
  action: Action,
  now: Date = new Date(),
): Promise<UsageResult> {
  await ensureIndexes();

  for (const rule of RULES[action]) {
    const ok = await take(rule.scope === "site" ? SITE : userId, action, rule, now);
    if (!ok) {
      return { ok: false, message: rule.message, retryAfterSeconds: secondsLeft(rule.window, now) };
    }
  }
  return { ok: true };
}
