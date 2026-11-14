# Phase 4 checklist: structured analysis

Run `npm install` (adds `zod` explicitly), restart `npm run dev`, then `npm run lint` and `npm run build`.
Report anything that differs from what is written here, including the exact message.

## What Phase 4 added
- On upload, two background jobs now run side by side: search vectors (Phase 3) and the analysis (new). Each has its own status, so one can fail while the other works.
- The Summary, Key points, Names and numbers, and Action items tabs are live. Every item has yellow page chips; clicking one opens that page in the Text tab.
- Names, dates and amounts whose wording can't be found on the cited pages are marked "Couldn't find this exact wording in the text. Check the cited page."
- Documents uploaded before Phase 4 show an "Analyze this document" button. A failed analysis shows "Try again". Neither needs a re-upload.
- New route: `GET/POST /api/documents/:id/analysis`. New collection: `analyses`.

## Checks

1. **Upload a real PDF** (5 to 20 pages, with names, dates and amounts in it).
   Expect: it opens on the Text tab, the Summary tab shows "Analyzing this document", and within about a minute it fills in. The Search tab switches on by itself too.
2. **Summary tab**: a document type label, a readable overview, "Mostly from p.N" chips.
3. **Key points**: 4 to 10 numbered points. Click a chip, it must jump to that page.
4. **Names and numbers**: pick 3 amounts or dates and find them on the cited page. They should match word for word. Note any item with the "check the cited page" line, and whether the item really is wrong.
5. **Action items**: owner and due appear only when the document states them.
6. **Word and text files**: upload a .docx and a .txt. Chips refer to the estimated pages.
7. **Non-English**: upload an Urdu or Chinese text. The analysis should be in that language.
8. **Old document** (uploaded before Phase 4): Summary tab shows "Analyze this document". Click it. It shows "Analyzing", then fills in. Clicking twice quickly must not start two runs.
9. **Wrong key**: put a wrong `GOOGLE_GENERATIVE_AI_API_KEY`, restart, upload. The upload is refused or both jobs fail cleanly with plain messages, and no key or raw error text appears in the browser.
10. **Delete while analyzing**: upload, delete straight away. It must not reappear, and nothing should be left behind in MongoDB (`documents`, `pages`, `chunks`, `analyses` all clear of that document).
11. **Failure and retry**: stop the network (or use the wrong key) during analysis, then restore it. Failed shows a message and "Try again". Trying again works.
12. **Scan or empty analysis categories**: a document with no people or amounts shows "No names, dates, or amounts were found" rather than blank space.
13. **Phone width**: the four tabs scroll sideways inside the tab bar and the content stays readable.

## Things I could not test, so watch for them
- Real responses from `gemini-3.8-flash`. If the first run fails with a 400 in the server log, the likely cause is `ANALYSIS_THINKING_LEVEL = "low"` in `lib/ai/config.ts`. Set it to `undefined` and restart.
- Your free-tier limits for the model. Check AI Studio. A 429 is retried with waits, so a big document may take a few minutes.
- A very large document (near 400,000 characters). The whole text goes in one request.
- The UI and database code have been type-checked only by reading, not run.
