# DocLens

Upload a document, get a summary, and ask it questions. Every answer points to the page it came from.

**Status: Phase 1 of 7.** Sign-in, database connection and the three-panel workspace shell. Upload, analysis and chat arrive in the next phases.

## Stack

Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4, Better Auth, MongoDB Atlas.

## Run it locally

1. Install dependencies

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

## Project layout

```
app/
  api/auth/[...all]/route.ts   Better Auth endpoints
  login/page.tsx               Sign-in page
  workspace/page.tsx           Protected workspace
  layout.tsx, globals.css      Fonts and design tokens
components/                    UI pieces (auth form, panels, shell)
lib/
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
