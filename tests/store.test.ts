import "./testdb"; // must be first: points the app at the test database
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { client, db } from "../lib/mongodb";
import {
  appendChatTurn, beginAnalysis, clearChat, createProcessingDocument, deleteDocument, deleteExpiredDocuments,
  failAnalysis, finishAnalysis, getAllPages, getAnalysis, getChatMessages, getDocument, listDocuments,
} from "../lib/documents/store";
import type { DocumentAnalysis } from "../lib/types";

const A = "user-a", B = "user-b";
const analysis: DocumentAnalysis = { summary: { documentType: "Contract", overview: "Acme pays.", pages: [1] }, keyPoints: [], people: [], organizations: [], dates: [], amounts: [], actionItems: [] };
const make = (userId = A, pages = ["page one", "page two", "page three"]) =>
  createProcessingDocument({ userId, title: "t.pdf", fileType: "pdf", fileSize: 10, pages, pagesAreEstimated: false, chunkCount: 3 });

before(async () => {
  await client.connect();
  assert.equal(db.databaseName, "doclens_test", "refusing to drop a database that is not the test one");
  await db.dropDatabase();
});
after(async () => { await client.close(); });

test("create: analysis starts as processing; pages come back in order", async () => {
  const d = await make();
  assert.equal(d.analysisStatus, "processing"); assert.equal(d.status, "processing"); assert.equal(d.analysisGeneratedAt, undefined);
  assert.deepEqual(await getAllPages(A, d.id), ["page one", "page two", "page three"]);
  assert.equal(await getAllPages(B, d.id), null);          // another user sees nothing
  assert.equal(await getAllPages(A, "not-an-id"), null);
});

test("analysis: begin is atomic (two at once -> one wins), finish/fail/get", async () => {
  const d = await make();
  assert.equal(await beginAnalysis(A, d.id), false);        // already processing from upload
  assert.equal(await finishAnalysis({ userId: A, documentId: d.id, content: analysis, model: "m1" }), true);
  const after1 = await getDocument(A, d.id);
  assert.equal(after1?.analysisStatus, "ready"); assert.ok(after1?.analysisGeneratedAt);
  const stored = await getAnalysis(A, d.id);
  assert.equal(stored?.model, "m1"); assert.equal(stored?.content.summary.overview, "Acme pays.");
  assert.equal(await getAnalysis(B, d.id), null);

  const results = await Promise.all([beginAnalysis(A, d.id), beginAnalysis(A, d.id), beginAnalysis(A, d.id)]);
  assert.equal(results.filter(Boolean).length, 1);          // exactly one run may start
  assert.equal((await getDocument(A, d.id))?.analysisStatus, "processing");
  assert.equal(await beginAnalysis(B, d.id), false);        // not B's document

  await failAnalysis(A, d.id, "The AI service is busy.");
  const failed = await getDocument(A, d.id);
  assert.equal(failed?.analysisStatus, "failed"); assert.equal(failed?.analysisError, "The AI service is busy.");
  assert.equal(await beginAnalysis(A, d.id), true);         // retry allowed, clears the error
  assert.equal((await getDocument(A, d.id))?.analysisError, undefined);
  // regenerate: new result replaces the old one, generatedAt changes
  const before1 = after1?.analysisGeneratedAt;
  await new Promise((r) => setTimeout(r, 5));
  await finishAnalysis({ userId: A, documentId: d.id, content: { ...analysis, summary: { ...analysis.summary, overview: "Second." } }, model: "m2" });
  assert.equal((await getAnalysis(A, d.id))?.content.summary.overview, "Second.");
  assert.notEqual((await getDocument(A, d.id))?.analysisGeneratedAt, before1);
  assert.equal(await db.collection("analyses").countDocuments({ documentId: new ObjectId(d.id) }), 1);
});

test("analysis: legacy document (no analysisStatus) shows 'none' and can begin", async () => {
  const d = await make();
  await db.collection("documents").updateOne({ _id: new ObjectId(d.id) }, { $unset: { analysisStatus: "", analysisStartedAt: "" } });
  assert.equal((await getDocument(A, d.id))?.analysisStatus, "none");
  assert.equal(await beginAnalysis(A, d.id), true);
});

test("analysis: deleted while processing -> finish saves nothing, no orphans", async () => {
  const d = await make();
  assert.equal(await deleteDocument(A, d.id), true);
  assert.equal(await finishAnalysis({ userId: A, documentId: d.id, content: analysis, model: "m" }), false);
  assert.equal(await db.collection("analyses").countDocuments({ documentId: new ObjectId(d.id) }), 0);
  assert.equal(await getDocument(A, d.id), null);
});

test("analysis: stale 'processing' is swept to failed; fresh one is not", async () => {
  const stale = await make(), fresh = await make();
  await db.collection("documents").updateOne({ _id: new ObjectId(stale.id) }, { $set: { analysisStartedAt: new Date(Date.now() - 11 * 60_000) } });
  const list = await listDocuments(A);
  assert.equal(list.find((x) => x.id === stale.id)?.analysisStatus, "failed");
  assert.match(list.find((x) => x.id === stale.id)?.analysisError ?? "", /interrupted/i);
  assert.equal(list.find((x) => x.id === fresh.id)?.analysisStatus, "processing");
});

test("chat: first turn creates the record; both messages saved with pages", async () => {
  const d = await make();
  assert.deepEqual(await getChatMessages(A, d.id), []);
  await appendChatTurn({ userId: A, documentId: d.id, question: "When is it due?", answer: "In 30 days [p.8].", pages: [3, 8] });
  const m = await getChatMessages(A, d.id);
  assert.equal(m.length, 2);
  assert.deepEqual(m.map((x) => x.role), ["user", "assistant"]);
  assert.deepEqual(m.map((x) => x.content), ["When is it due?", "In 30 days [p.8]."]);
  assert.deepEqual(m[0].pages, []); assert.deepEqual(m[1].pages, [3, 8]);
  assert.notEqual(m[0].id, m[1].id);
  await appendChatTurn({ userId: A, documentId: d.id, question: "And fees?", answer: "2%.", pages: [3] });
  assert.deepEqual((await getChatMessages(A, d.id)).map((x) => x.content), ["When is it due?", "In 30 days [p.8].", "And fees?", "2%."]);
  assert.equal(await db.collection("chats").countDocuments({ documentId: new ObjectId(d.id) }), 1);
});

test("chat: 10 first answers finishing at the same moment all get saved (unique-index race)", async () => {
  const d = await make();
  await Promise.all(Array.from({ length: 10 }, (_, i) => appendChatTurn({ userId: A, documentId: d.id, question: `q${i}`, answer: `a${i}`, pages: [] })));
  const m = await getChatMessages(A, d.id);
  assert.equal(m.length, 20);
  assert.deepEqual([...m.filter((x) => x.role === "user").map((x) => x.content)].sort(), Array.from({ length: 10 }, (_, i) => `q${i}`).sort());
  assert.equal(await db.collection("chats").countDocuments({ documentId: new ObjectId(d.id) }), 1);
  // each question stays directly before its own answer
  for (let i = 0; i < m.length; i += 2) assert.equal(m[i].content.replace("q", ""), m[i + 1].content.replace("a", ""));
});

test("chat: only the newest 100 messages are kept", async () => {
  const d = await make();
  for (let i = 0; i < 60; i++) await appendChatTurn({ userId: A, documentId: d.id, question: `q${i}`, answer: `a${i}`, pages: [] });
  const m = await getChatMessages(A, d.id);
  assert.equal(m.length, 100);
  assert.equal(m[0].content, "q10"); assert.equal(m[99].content, "a59");
});

test("chat: other users and missing documents are safe", async () => {
  const d = await make();
  await appendChatTurn({ userId: B, documentId: d.id, question: "sneaky", answer: "x", pages: [] });   // B does not own it
  assert.deepEqual(await getChatMessages(A, d.id), []); assert.deepEqual(await getChatMessages(B, d.id), []);
  await appendChatTurn({ userId: A, documentId: d.id, question: "mine", answer: "ok", pages: [] });
  assert.deepEqual(await getChatMessages(B, d.id), []);
  await clearChat(B, d.id);                                   // B can't clear A's chat
  assert.equal((await getChatMessages(A, d.id)).length, 2);
  const ghost = new ObjectId().toHexString();
  await appendChatTurn({ userId: A, documentId: ghost, question: "q", answer: "a", pages: [] });
  assert.equal(await db.collection("chats").countDocuments({ documentId: new ObjectId(ghost) }), 0);
  await appendChatTurn({ userId: A, documentId: "bad-id", question: "q", answer: "a", pages: [] });
  assert.deepEqual(await getChatMessages(A, "bad-id"), []); await clearChat(A, "bad-id");
});

test("chat: clear empties it; delete document removes chat, pages and analysis", async () => {
  const d = await make();
  await finishAnalysis({ userId: A, documentId: d.id, content: analysis, model: "m" });
  await appendChatTurn({ userId: A, documentId: d.id, question: "q", answer: "a", pages: [1] });
  await clearChat(A, d.id);
  assert.deepEqual(await getChatMessages(A, d.id), []);
  await appendChatTurn({ userId: A, documentId: d.id, question: "q2", answer: "a2", pages: [1] });   // works again after clearing
  assert.equal((await getChatMessages(A, d.id)).length, 2);
  assert.equal(await deleteDocument(B, d.id), false);
  assert.equal(await deleteDocument(A, d.id), true);
  const id = new ObjectId(d.id);
  for (const c of ["documents", "pages", "chunks", "analyses", "chats"]) {
    assert.equal(await db.collection(c).countDocuments(c === "documents" ? { _id: id } : { documentId: id }), 0, c);
  }
});

test("indexes exist", async () => {
  const idx = async (c: string) => (await db.collection(c).indexes()).map((i) => JSON.stringify(i.key) + (i.unique ? "U" : ""));
  assert.ok((await idx("chats")).includes('{"documentId":1}U'));
  assert.ok((await idx("analyses")).includes('{"documentId":1}U'));
});

test("cleanup: deletes only documents older than the cutoff, with everything attached, in batches", async () => {
  const old1 = await make(A), old2 = await make(B), old3 = await make(A), fresh = await make(A);
  for (const d of [old1, old2, old3]) {
    await finishAnalysis({ userId: d.id === old2.id ? B : A, documentId: d.id, content: analysis, model: "m" });
    await appendChatTurn({ userId: d.id === old2.id ? B : A, documentId: d.id, question: "q", answer: "a", pages: [1] });
    await db.collection("documents").updateOne({ _id: new ObjectId(d.id) }, { $set: { createdAt: new Date(Date.now() - 15 * 86400_000) } });
  }
  await db.collection("documents").updateOne({ _id: new ObjectId(fresh.id) }, { $set: { createdAt: new Date(Date.now() - 13 * 86400_000) } });
  const cutoff = new Date(Date.now() - 14 * 86400_000);
  assert.equal(await deleteExpiredDocuments(cutoff, 2), 2);        // batch size respected
  assert.equal(await deleteExpiredDocuments(cutoff, 2), 1);        // the rest
  assert.equal(await deleteExpiredDocuments(cutoff, 2), 0);        // nothing left
  for (const d of [old1, old2, old3]) {
    const id = new ObjectId(d.id);
    for (const c of ["documents", "pages", "chunks", "analyses", "chats"]) assert.equal(await db.collection(c).countDocuments(c === "documents" ? { _id: id } : { documentId: id }), 0, c);
  }
  assert.ok(await getDocument(A, fresh.id));                         // 13 days old: kept
  assert.equal((await getAllPages(A, fresh.id))?.length, 3);
});
