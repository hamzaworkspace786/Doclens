// A small load test for YOUR OWN DocLens deployment. No packages needed.
//
//   node scripts/load-test.mjs --url https://your-app.vercel.app
//   node scripts/load-test.mjs --url http://localhost:3000 --concurrency 20 --seconds 20
//   node scripts/load-test.mjs --url https://your-app.vercel.app --ramp
//
// It sends only GET requests, so it can never upload, ask a question, or use up
// your Gemini quota. By default it tests the public pages (/api/health, /login,
// /privacy). To also test signed-in pages (the document list), sign in in your
// browser, copy the cookie from DevTools > Application > Cookies, and pass it:
//
//   DOCLENS_COOKIE="better-auth.session_token=...; " node scripts/load-test.mjs --url ...
//
// Only test your own deployment, and keep the numbers modest: a free Vercel plan and
// a free Atlas cluster are meant for tens of people, not thousands.

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

if (flag("help")) {
  console.log("Options: --url <address>  --concurrency <n=10>  --seconds <n=15>  --ramp  --path </extra/get/path>");
  process.exit(0);
}

const base = option("url", process.env.DOCLENS_URL ?? "http://localhost:3000").replace(/\/$/, "");
const seconds = Number(option("seconds", flag("ramp") ? "10" : "15"));
const concurrency = Number(option("concurrency", "10"));
const cookie = process.env.DOCLENS_COOKIE ?? "";

const MAX_CONCURRENCY = 50;
const MAX_SECONDS = 60;
if (!(concurrency >= 1 && seconds >= 1) || concurrency > MAX_CONCURRENCY || seconds > MAX_SECONDS) {
  console.error(`Keep --concurrency between 1 and ${MAX_CONCURRENCY} and --seconds between 1 and ${MAX_SECONDS}.`);
  process.exit(1);
}

const paths = ["/api/health", "/login", "/privacy"];
if (cookie) paths.push("/api/documents");
const extra = option("path", "");
if (extra) paths.push(extra.startsWith("/") ? extra : `/${extra}`);

const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);

async function hit(path) {
  const started = performance.now();
  try {
    const response = await fetch(base + path, {
      headers: cookie ? { cookie } : {},
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    await response.arrayBuffer(); // read the whole body, like a browser would
    return { path, ms: performance.now() - started, status: response.status };
  } catch (error) {
    return { path, ms: performance.now() - started, status: error?.name === "TimeoutError" ? "timeout" : "error" };
  }
}

async function runStep(workers) {
  const results = [];
  const stopAt = performance.now() + seconds * 1000;
  let next = 0;

  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (performance.now() < stopAt) {
        results.push(await hit(paths[next++ % paths.length]));
      }
    }),
  );
  return results;
}

function report(workers, results) {
  const rows = [];
  for (const path of paths) {
    const mine = results.filter((r) => r.path === path);
    if (mine.length === 0) continue;
    const times = mine.map((r) => r.ms).sort((a, b) => a - b);
    const codes = {};
    for (const r of mine) codes[r.status] = (codes[r.status] ?? 0) + 1;
    rows.push({
      path,
      requests: mine.length,
      "req/s": +(mine.length / seconds).toFixed(1),
      "p50 ms": Math.round(percentile(times, 50)),
      "p95 ms": Math.round(percentile(times, 95)),
      "p99 ms": Math.round(percentile(times, 99)),
      "max ms": Math.round(times[times.length - 1]),
      statuses: Object.entries(codes).map(([k, v]) => `${k}x${v}`).join(" "),
    });
  }
  console.log(`\n${workers} at once, ${seconds}s, ${base}`);
  console.table(rows);

  const failures = results.filter((r) => typeof r.status !== "number" || r.status >= 500).length;
  const limited = results.filter((r) => r.status === 429).length;
  const p95 = percentile(results.map((r) => r.ms).sort((a, b) => a - b), 95);
  const verdict = failures > 0 ? "ERRORS" : p95 > 2000 ? "SLOW" : "OK";
  console.log(`verdict: ${verdict}  (failures: ${failures}, rate-limited: ${limited}, overall p95: ${Math.round(p95)} ms)`);
  return { verdict, failures, p95 };
}

console.log(`Load test of ${base}\nGET only: this cannot use your AI quota. Paths: ${paths.join(", ")}`);
if (!cookie) console.log("No DOCLENS_COOKIE set, so signed-in pages are not tested.");

const steps = flag("ramp") ? [1, 5, 10, 20, 40] : [concurrency];
let worst = "OK";
for (const workers of steps) {
  const outcome = report(workers, await runStep(workers));
  if (outcome.verdict === "ERRORS") worst = "ERRORS";
  else if (outcome.verdict === "SLOW" && worst === "OK") worst = "SLOW";
  if (outcome.verdict === "ERRORS" && flag("ramp")) {
    console.log(`Stopped: it started failing at ${workers} at once.`);
    break;
  }
}
console.log(`\nOverall: ${worst}`);
process.exit(worst === "ERRORS" ? 1 : 0);
