# DocLens

Upload a document, get a summary, and ask it questions. Every answer points to the page it came from.

**Status: Phase 2 of 7.** Sign-in, upload, text extraction and chunking. You can upload PDF, Word and text files, read them page by page, and delete them. Embeddings, analysis and chat arrive in the next phases.

## Stack

Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4, Better Auth, MongoDB Atlas, unpdf (PDF text), mammoth (Word text).

## Run it locally

1. Install dependencies (Phase 2 added `unpdf` and `mammoth`)

   ```bash
   npm install
   ```

2. Create your env file

   ```bash
   cp .env.example .env.local
   ```

3. Fill in `.env.local`

   | Variable | Where to get it |
   |---|---|
   | `MONGODB_URI` | Atlas > Database > Connect > Drivers. Add your current IP under Network Access. |
   | `BETTER_AUTH_SECRET` | Run `openssl rand -base64 32` |
   | `BETTER_AUTH_URL` | `http://localhost:3000` locally, your real domain in production |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console > APIs & Services > Credentials > Create OAuth client ID (Web application) |

   For Google, add this **Authorized redirect URI**: `http://localhost:3000/api/auth/callback/google`
   (and `https://YOUR-DOMAIN/api/auth/callback/google` when you deploy).

   Google is optional while developing. Without the two Google variables, email and password sign-in still works.

4. Start the dev server

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. You'll be sent to `/login`.

## Phase 1 checklist

- [ ] `/` redirects to `/login` when signed out
- [ ] You can create an account with email and password
- [ ] After signing in you land on `/workspace` and see your name and email in the header
- [ ] Refreshing `/workspace` keeps you signed in
- [ ] Sign out returns you to `/login`, and `/workspace` redirects back to `/login`
- [ ] Google sign-in works (if you set the Google variables)
- [ ] In MongoDB Atlas you see `user`, `session` and `account` collections in the `doclens` database
- [ ] Narrow the browser window: the three panels turn into tabs

## Phase 2: what was added

**How an upload is processed** (`POST /api/documents`):

1. Check the user is signed in and under the document limit.
2. Validate the file: extension, size, and the real first bytes (not just the name).
3. Extract text per page. PDFs keep their real pages. Word and text files have no pages, so they are cut into pages of about 3,000 characters.
4. Split every page into chunks of about 800 characters with a small overlap. Chunks never cross a page, so each one can cite a single page.
5. Save the document, its pages, and its chunks. If any step fails, everything saved so far is removed.

**API**

| Route | What it does |
|---|---|
| `GET /api/documents` | List your documents, newest first |
| `POST /api/documents` | Upload one file (multipart field `file`) |
| `GET /api/documents/:id` | One document's details |
| `DELETE /api/documents/:id` | Delete the document, its pages, and its chunks |
| `GET /api/documents/:id/pages/:page` | Text of one page |

Every route checks the session, and every query filters by `userId`, so one user can never read or delete another user's documents.

**MongoDB collections** (created automatically, with indexes): `documents`, `pages`, `chunks`.

**Limits** (all in `lib/constants.ts`): 4 MB per file, 10 documents per user, 150 pages, 400,000 characters.

**Not supported yet:** scanned PDFs (no selectable text), password-protected PDFs, old `.doc` files.

## Phase 2 checklist

- [ ] Upload a PDF: it appears in the list, opens on the Text tab, and the header shows page and chunk counts
- [ ] Use Next, Previous, and the page dropdown to move through the pages
- [ ] Upload a `.docx` and a `.txt`: both show "about N pages" and the note explaining estimated pages
- [ ] Upload a scanned PDF, a password-protected PDF, and a file renamed to `.pdf`: each shows a clear error and nothing is added to the list
- [ ] Upload a file over 4 MB: it is rejected without being sent
- [ ] Refresh the page: your documents are still there
- [ ] Delete a document (the trash icon, then Delete): it disappears
- [ ] In Atlas, the `doclens` database now has `documents`, `pages`, and `chunks` collections
- [ ] Sign in as a second account: it sees none of the first account's documents

## Project layout

```
app/
  api/auth/[...all]/route.ts   Better Auth endpoints
  login/page.tsx               Sign-in page
  api/documents/               Upload, list, delete, read pages
  workspace/page.tsx           Protected workspace
  layout.tsx, globals.css      Fonts and design tokens
components/                    UI pieces (auth form, document list, page viewer, shell)
lib/
  constants.ts                 Limits shared by browser and server
  types.ts, format.ts          Shared types and display helpers
  use-documents.ts             Browser hook: list, upload, delete
  documents/
    validate.ts                File checks
    parse.ts                   PDF, Word and text extraction
    paginate.ts                Pages for Word and text files
    chunk.ts                   Splitting pages into chunks
    store.ts                   MongoDB reads and writes for documents
  mongodb.ts                   Shared MongoDB client
  auth.ts                      Better Auth server config
  auth-client.ts               Better Auth browser client
  session.ts                   getSession() and requireUser()
proxy.ts                       Quick cookie check for /workspace
```

## Notes for this Next.js version

- `middleware.ts` is now `proxy.ts`.
- Cache Components is on, so any component that reads the session (cookies or headers) must sit inside `<Suspense>`. `app/workspace/page.tsx` and `app/login/page.tsx` show the pattern.
- `proxy.ts` only checks that a session cookie exists. Always call `requireUser()` in server code that touches user data.

## Design tokens

Defined in `app/globals.css`. Ink-blue surfaces, with one highlighter-yellow accent (`--color-mark`) reserved for citations, marks and focus rings. UI text is Instrument Sans; document text is Source Serif 4.
