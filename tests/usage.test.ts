import "./testdb"; // must be first: points the app at the test database
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { client, db } from "../lib/mongodb";
import { bucketFor, consume, secondsLeft } from "../lib/usage";
import { LIMITS } from "../lib/constants";

before(async () => {
  await client.connect();
  assert.equal(db.databaseName, "doclens_test", "refusing to drop a database that is not the test one");
  await db.dropDatabase();
});
after(async () => { await client.close(); });

const T = new Date("2026-11-15T10:23:30.000Z");
const run = async (user: string, action: "upload" | "question" | "reanalysis", n: number, now = T) => {
  const out = []; for (let i = 0; i < n; i++) out.push(await consume(user, action, now)); return out;
};

test("buckets and seconds left", () => {
  assert.equal(bucketFor("minute", T), "2026-11-15T10:23");
  assert.equal(bucketFor("hour", T), "2026-11-15T10");
  assert.equal(bucketFor("day", T), "2026-11-15");
  assert.equal(secondsLeft("minute", T), 30);
  assert.equal(secondsLeft("hour", T), 3600 - (23 * 60 + 30));
  assert.equal(secondsLeft("day", T), 86400 - (10 * 3600 + 23 * 60 + 30));
  assert.equal(secondsLeft("minute", new Date("2026-11-15T10:23:00.000Z")), 60);
});

test("questions: per-minute limit blocks the next one, with a clear message and retry time", async () => {
  const r = await run("u1", "question", LIMITS.questionsPerMinute + 2);
  assert.equal(r.filter((x) => x.ok).length, LIMITS.questionsPerMinute);
  const blocked = r[LIMITS.questionsPerMinute];
  assert.equal(blocked.ok, false);
  if (!blocked.ok) { assert.match(blocked.message, /very fast/); assert.equal(blocked.retryAfterSeconds, 30); }
});

test("a new minute starts fresh; another user is unaffected", async () => {
  const later = new Date(T.getTime() + 60_000);
  assert.equal((await consume("u1", "question", later)).ok, true);
  assert.equal((await consume("u2", "question", T)).ok, true);
});

test("30 simultaneous questions from one user: exactly the limit gets through (no race)", async () => {
  const results = await Promise.all(Array.from({ length: 30 }, () => consume("racer", "question", T)));
  assert.equal(results.filter((x) => x.ok).length, LIMITS.questionsPerMinute);
  const doc = await db.collection("usage").findOne({ userId: "racer", kind: "question", bucket: "2026-11-15T10:23" });
  assert.equal(doc?.count, LIMITS.questionsPerMinute);
  assert.equal(await db.collection("usage").countDocuments({ userId: "racer", kind: "question", bucket: "2026-11-15T10:23" }), 1);
});

test("daily question limit across many minutes", async () => {
  let ok = 0, last: Awaited<ReturnType<typeof consume>> | undefined;
  for (let m = 0; m < 40; m++) {          // 40 minutes x up to 8/min, but the day cap is 60
    const now = new Date(Date.UTC(2026, 10, 16, 8, m, 5));
    for (let i = 0; i < 3; i++) { last = await consume("daily", "question", now); if (last.ok) ok++; }
  }
  assert.equal(ok, LIMITS.questionsPerDay);
  assert.ok(last && !last.ok && /today's limit/.test(last.message));
  // next day resets
  assert.equal((await consume("daily", "question", new Date(Date.UTC(2026, 10, 17, 0, 0, 1)))).ok, true);
});

test("uploads: hourly cap, then the next hour allows more until the daily cap", async () => {
  const h = (hour: number) => new Date(Date.UTC(2026, 10, 18, hour, 10, 0));
  const first = await run("up", "upload", LIMITS.uploadsPerHour + 1, h(9));
  assert.equal(first.filter((x) => x.ok).length, LIMITS.uploadsPerHour);
  const b = first[LIMITS.uploadsPerHour]; assert.ok(!b.ok && /per hour/.test(b.message));
  // The blocked attempt stopped at the hourly rule, so it did not use up a daily slot.
  const second = await run("up", "upload", 5, h(10));
  assert.equal(second.filter((x) => x.ok).length, LIMITS.uploadsPerDay - LIMITS.uploadsPerHour);
  const dayBlocked = second.find((x) => !x.ok);
  assert.ok(dayBlocked && !dayBlocked.ok && /per day/.test(dayBlocked.message));
});

test("site-wide limit blocks everyone with the 'busy' message", async () => {
  for (let i = 0; i < LIMITS.siteReanalysesPerDay; i++) assert.equal((await consume(`site-user-${i}`, "reanalysis", T)).ok, true);
  const r = await consume("one-more", "reanalysis", T);
  assert.ok(!r.ok && /very busy today/.test(r.message));
  const other = await consume("another", "question", T);                 // other actions are separate
  assert.equal(other.ok, true);
});

test("counters expire by themselves (TTL) and are stored per kind", async () => {
  const idx = (await db.collection("usage").indexes()).map((i) => ({ key: JSON.stringify(i.key), ttl: i.expireAfterSeconds, unique: i.unique }));
  assert.ok(idx.some((i) => i.key === '{"expiresAt":1}' && i.ttl === 0));
  assert.ok(idx.some((i) => i.key === '{"userId":1,"kind":1,"bucket":1}' && i.unique));
  const doc = await db.collection("usage").findOne({ userId: "u2", kind: "question" });
  assert.ok(doc && doc.expiresAt.getTime() > T.getTime() + 3600_000);
});
