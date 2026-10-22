# Research Mate

An AI research partner that turns a student's idea into well-sourced research, one step at a time.
Students answer three questions on **Start** (topic, what they're writing, their level) and the AI does the rest on
**Generate**: it picks a research question, finds and saves trusted sources, takes notes, builds the outline and writes
every section. They land on **Review**, which lays the finished paper out like a journal article (letter-size pages, abstract and
keywords, two columns, numbered pages), with checks and exports beside it. PDF / Print gives the same pages.
The hands-on steps (Refine, Sources, Notes, Outline, Write) are still there for anyone who wants to change something.

Students sign up with email and password and confirm their email before signing in. Each account's projects are saved in Supabase and protected by
row-level security, so nobody can read or change another student's work.

## Getting started

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. You'll be sent to `/login` until Supabase is set up (below).

## Setting up Supabase (database and sign-in)

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql). It creates the `profiles` and
   `projects` tables, their row-level security policies, and a trigger that makes a profile on sign-up.
3. Copy `.env.example` to `.env.local` and set, from **Project Settings → API**:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
   ```

   Never put the `service_role` / secret key in a `NEXT_PUBLIC_` variable.
4. Turn on email verification:
   - **Authentication → Sign In / Providers → Email**: keep **Confirm email** on. New students get a link
     and can't sign in until they open it.
   - **Authentication → URL Configuration**: set **Site URL** to your app's address and add
     `http://localhost:3000/auth/confirm` (and your deployed `https://…/auth/confirm`) to **Redirect URLs**.
   - **Authentication → Emails → Confirm signup**: so the link also works when opened on another device
     (a phone, a school computer), change the link to:

     ```html
     <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
     ```

     Without this change the default link still works, but only in the browser the student signed up in.
   - **Authentication → Emails → Reset Password**: same idea, for the "Forgot password?" email:

     ```html
     <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a>
     ```

     The link signs the student in at `/auth/confirm` and sends them to `/reset-password`. Without this
     change it only works in the browser that asked for the email.
   - Supabase's built-in mailer sends only a few emails an hour; set up custom SMTP under
     **Project Settings → Authentication** before real students sign up.
5. Restart `pnpm dev`.

Projects saved in a browser before sign-in existed are moved into the first account that signs in there.

## Turning on the AI agents

Without a key the app still runs. A simple built-in helper suggests angles, sorts notes,
checks wording and finds gaps. Finding sources and checking claims against them needs Claude,
which the app reaches through [Vercel AI Gateway](https://vercel.com/docs/ai-gateway).

1. Create a key in the Vercel dashboard under **AI Gateway → API keys**.
2. Copy `.env.example` to `.env.local` in the project root and set:

   ```bash
   AI_GATEWAY_API_KEY=your-key-here
   ```

3. Restart `pnpm dev`. Next.js reads `.env.local` only at startup.

On Vercel, add the same `AI_GATEWAY_API_KEY` under **Project Settings → Environment Variables**.
Optional: `RESEARCH_MATE_MODEL` overrides the model (default `anthropic/claude-opus-5-5`).

## Where the AI helps

| Step | AI help |
|---|---|
| Start / Refine | Research Planner turns the idea into angles, questions and a plan |
| Sources | Source Discovery searches the web (only links the search returned are kept); Document Analysis reads uploaded files |
| Notes | Evidence Synthesis sorts notes into themes and flags contradictions |
| Outline | Outline Builder groups notes into sections with a main idea each; Research Gap finds unanswered questions |
| Write | Writing Partner drafts one section, or every empty section, from the student's notes and saved sources, with citations; Improve paragraph suggests wording |
| Review | Fix with AI repairs flagged claims using saved sources; Feedback reviews the whole paper; Fix all corrects grammar |

AI drafts are built only from the student's notes and saved sources. Citations to anything outside the
bibliography are removed, drafts never overwrite text the student wrote, and each single-section draft is
shown for the student to approve before it goes into the paper.

## Checks

```bash
pnpm test     # unit tests (Vitest)
pnpm lint     # ESLint
pnpm exec tsc --noEmit
pnpm build
```

## Structure

- `app/` screens (one folder per wireframe step) and `app/api/agents/[agent]` (the agent endpoint)
- `lib/agents/` agent input/output schemas and the offline helper
- `lib/server/` Claude calls (server only); API key never reaches the browser
- `proxy.ts`, `lib/supabase/` session refresh and page gating; Supabase clients for browser and server
- `app/login`, `app/signup` sign-in and sign-up pages; `app/forgot-password`, `app/reset-password` the password reset flow;
  `app/auth/confirm` where the verification and reset email links land
- `lib/db/` reads and writes the `projects` table; `lib/store.ts` keeps the open project in memory and saves changes
- `supabase/schema.sql` tables, triggers and row-level security policies
- `lib/checks.ts`, `lib/citations.ts`, `lib/credibility.ts` originality, grammar, citation and source-trust logic
- `lib/i18n/` English and Hindi text (both must have every key)
- `tests/` unit tests for the pure logic

## Known limits

- Source summaries come from web search results, not from reading each full page, so students should open
  the original before relying on a fact.
- Grammar and spelling checks cover English only. Hindi text is still checked for originality and citations.
- Word export produces a `.doc` file from HTML. PDF is made with the browser's print dialog.
