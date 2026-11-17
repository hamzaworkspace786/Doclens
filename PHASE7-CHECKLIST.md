# Phase 7 checklist: ready for visitors

## Before you push
1. `npm install` (adds `tsx` for the tests).
2. Put the 6 test files in a new `tests/` folder in the project (they are attached in the chat).
3. `npm run lint` and `npm run build` must pass.
4. Optional: `npm run test:unit` (no database needed). For all tests, point `TEST_MONGODB_URI` at a local MongoDB or a separate free Atlas cluster (never your real one).

## On Vercel (one time)
1. Add `CRON_SECRET` (any long random value). Without it the daily cleanup refuses to run.
2. Check `BETTER_AUTH_URL` is your real address, and Atlas Network Access allows `0.0.0.0/0`.
3. Open Google AI Studio, look at your key's daily limits, and set `LIMITS` in `lib/constants.ts` to about 60 to 80 percent of them. Redeploy.
4. After the push deploys: Vercel > your project > Settings > Cron Jobs should list `/api/cron/cleanup` (daily).

## Checks after deploying
1. `https://YOUR-APP/api/health` shows `{"ok":true,"database":true,"ai":true,...}`.
2. `https://YOUR-APP/privacy` opens without signing in. The login page and the document list both link to it.
3. Response headers (DevTools > Network > any page > Headers) include `x-content-type-options: nosniff` and `x-frame-options: DENY`.
4. Rate limit, upload: upload 9 small files in a row. The 6th is refused with "You can upload 5 documents per hour" (HTTP 429, shown in the red message under the Upload button).
5. Rate limit, questions: send 9 questions within a minute. The 9th shows "You're asking questions very fast."
6. Rate limit, sign-in: try 11 wrong passwords within a minute. The 11th is refused (production only; this feature is off in `npm run dev`).
7. Old documents: upload a file, then in MongoDB set its `createdAt` to 20 days ago. Run the cleanup by hand (below). The document, its chat and its analysis disappear.
8. Background tab: open a document that is analyzing, switch to another browser tab for 30 seconds, come back. Progress catches up within a few seconds.
9. Load test (your own site, GET only, cannot use AI quota):
   `npm run load-test -- --url https://YOUR-APP --ramp`
   Expect `Overall: OK`. If it says SLOW or ERRORS, note the concurrency where it started and tell me.

## Run the cleanup by hand
PowerShell: `curl.exe -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-APP/api/cron/cleanup`
Expect `{"deleted":N}`. Without the header you get 401.

## Known gaps (on purpose, free tier)
- No email verification (needs a domain you own for sending). Sign-up is rate limited per IP.
- No CAPTCHA, no Content-Security-Policy, files are limited to 4 MB.
- Limits are counted in UTC and are approximate: Google's quota resets on its own clock.
