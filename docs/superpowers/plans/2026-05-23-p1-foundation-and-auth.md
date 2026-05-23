# vids.tube P1 — Foundation + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the vids.tube Next.js app with Supabase auth, a base data model, and a public channel page — a deployable site you can sign into.

**Architecture:** Next.js (App Router, TypeScript) for the web app. Supabase provides Postgres, Auth, and (later) Realtime. Auth uses `@supabase/ssr` with cookie-based sessions refreshed in middleware. The data model is multi-channel-ready from day one (a `channels` table keyed to an owner), even though v1 has a single channel. Row Level Security (RLS) is enabled on every table.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, `@supabase/ssr` + `@supabase/supabase-js`, Supabase CLI (local Postgres via Docker), Vitest (unit/integration), Playwright (E2E).

**Scope of this plan (P1):** Project scaffold, testing tooling, Supabase local dev + migrations, auth client utilities, session-refresh middleware, signup/login/logout, a `requireUser` server helper, the `channels` schema with RLS, a seeded owner channel, a public channel page, and a Vercel deploy linked to a hosted Supabase project.

**Out of scope (later plans):** Video pipeline (P2), VOD playback (P3), credits/Stripe (P4), live playback/metering (P5), chat/comments/follow (P6).

**Prerequisites the executing engineer needs:**
- Node.js 20+ and npm installed.
- Docker Desktop running (required by `supabase start`).
- Supabase CLI installed (`npm i -g supabase` or scoop/brew). Verify with `supabase --version`.
- A free Supabase account (for the hosted project in the final task) and a Vercel account (final task only).

---

## File Structure

Files created or modified in P1:

```
package.json                          # deps + scripts
next.config.ts                        # Next config
tsconfig.json                         # TS config (create-next-app)
tailwind.config.ts, postcss.config.mjs# styling (create-next-app)
.env.local                            # Supabase URL + publishable key (gitignored)
.env.example                          # documents required env vars (committed)
middleware.ts                         # root middleware → session refresh
vitest.config.ts                      # Vitest config
playwright.config.ts                  # Playwright config

utils/supabase/client.ts              # browser Supabase client
utils/supabase/server.ts              # server Supabase client (cookies)
utils/supabase/middleware.ts          # updateSession() helper
utils/supabase/types.ts               # generated DB types (from CLI)

lib/auth.ts                           # requireUser() server helper

app/layout.tsx                        # root layout + nav
app/page.tsx                          # home page
app/globals.css                       # Tailwind entry
app/(auth)/login/page.tsx             # login form (client component)
app/(auth)/login/actions.ts           # login server action
app/(auth)/signup/page.tsx            # signup form (client component)
app/(auth)/signup/actions.ts          # signup server action
app/auth/signout/route.ts             # POST sign-out route
app/[channelSlug]/page.tsx            # public channel page
components/nav.tsx                     # nav with auth state

supabase/config.toml                  # created by `supabase init`
supabase/migrations/*_channels.sql     # channels table + RLS
supabase/seed.sql                      # seed owner channel (local dev)

tests/integration/rls-channels.test.ts # RLS behavior (Vitest)
tests/e2e/auth.spec.ts                 # signup/login/logout (Playwright)
tests/e2e/channel-page.spec.ts         # public channel page (Playwright)
```

**Responsibility boundaries:**
- `utils/supabase/*` — client construction only; no business logic.
- `lib/auth.ts` — the single place server code checks "who is the user."
- `app/(auth)/*` — auth UI + server actions, isolated in a route group.
- `app/[channelSlug]/page.tsx` — public read-only channel rendering.
- Migrations own schema + RLS; never edit applied migrations, add new ones.

---

## Task 1: Scaffold the Next.js app

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, Tailwind configs (all via create-next-app).

- [ ] **Step 1: Scaffold into the current directory**

Run (the trailing `.` scaffolds into the existing repo; answer prompts as shown by the flags):

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*" --no-turbopack --use-npm
```

If create-next-app refuses because the directory is non-empty (it contains `docs/` and `.git/`), scaffold in a temp dir and copy:

```bash
npx create-next-app@latest vids-tmp --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*" --no-turbopack --use-npm
cp -r vids-tmp/. .
rm -rf vids-tmp
```

- [ ] **Step 2: Verify the dev server boots**

Run:

```bash
npm run dev
```

Expected: server starts on `http://localhost:3000`, the default Next.js page renders. Stop it with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js App Router app with TypeScript and Tailwind"
```

---

## Task 2: Add testing tooling (Vitest + Playwright)

**Files:**
- Create: `vitest.config.ts`, `playwright.config.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install dev dependencies**

```bash
npm install -D vitest @vitest/coverage-v8 @playwright/test dotenv
npx playwright install chromium
```

- [ ] **Step 2: Create the test env loader `tests/setup-env.ts`**

The Supabase keys live in `.env.local`, but plain `dotenv/config` only reads `.env`. Load `.env.local` explicitly:

```ts
import { config } from "dotenv";

config({ path: ".env.local" });
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts", "tests/unit/**/*.test.ts"],
    setupFiles: ["tests/setup-env.ts"],
  },
});
```

- [ ] **Step 4: Create `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
```

- [ ] **Step 5: Add scripts to `package.json`**

Add these entries to the `"scripts"` object:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

- [ ] **Step 6: Verify tooling runs (no tests yet)**

```bash
npm test
```

Expected: Vitest runs and reports "No test files found" (exit 0 or a clear no-tests message). This confirms config loads.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: add Vitest and Playwright test tooling"
```

---

## Task 3: Initialize Supabase locally + env vars

**Files:**
- Create: `supabase/config.toml` (via CLI), `.env.local`, `.env.example`
- Modify: `.gitignore` (ensure `.env.local` ignored — create-next-app already ignores `.env*.local`)

- [ ] **Step 1: Initialize Supabase project files**

```bash
supabase init
```

Expected: creates `supabase/config.toml` and `supabase/` folder. Answer "N" if asked to generate VS Code settings.

- [ ] **Step 2: Start local Supabase (Docker)**

```bash
supabase start
```

Expected: pulls/starts containers, then prints a credentials block including `API URL` (e.g. `http://127.0.0.1:54321`), `anon key`, `service_role key`, and `Studio URL`. Keep this output.

- [ ] **Step 3: Create `.env.local`**

Use the `API URL` and **anon key** (this is the local publishable key) from Step 2:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key from supabase start output>
# Server-only, never sent to browser. Used by integration tests + admin scripts.
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start output>
```

- [ ] **Step 4: Create `.env.example` (committed, no secrets)**

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 5: Verify `.env.local` is gitignored**

Run:

```bash
git check-ignore .env.local
```

Expected: prints `.env.local` (meaning it is ignored). If it prints nothing, add `.env.local` to `.gitignore`.

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml .env.example
git commit -m "chore: initialize local Supabase and document env vars"
```

---

## Task 4: Supabase client utilities

**Files:**
- Create: `utils/supabase/client.ts`, `utils/supabase/server.ts`, `utils/supabase/middleware.ts`

- [ ] **Step 1: Install Supabase packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Create `utils/supabase/client.ts` (browser client)**

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

- [ ] **Step 3: Create `utils/supabase/server.ts` (server client)**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore when middleware
            // is refreshing the session.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 4: Create `utils/supabase/middleware.ts` (session refresh)**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getClaims().
  // getClaims() refreshes the auth token; getSession() is NOT trustworthy here.
  await supabase.auth.getClaims();

  return supabaseResponse;
}
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add utils/supabase package.json package-lock.json
git commit -m "feat: add Supabase browser, server, and middleware clients"
```

---

## Task 5: Wire session-refresh middleware

**Files:**
- Create: `middleware.ts` (repo root)

- [ ] **Step 1: Create `middleware.ts`**

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Verify the app still boots with middleware active**

```bash
npm run dev
```

Expected: home page loads at `http://localhost:3000` with no middleware errors in the terminal. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: refresh Supabase session in middleware"
```

---

## Task 6: `channels` schema migration + RLS

**Files:**
- Create: `supabase/migrations/<timestamp>_channels.sql`
- Create: `utils/supabase/types.ts` (generated)

- [ ] **Step 1: Create an empty migration file (correct filename format)**

```bash
supabase migration new channels
```

Expected: creates `supabase/migrations/<timestamp>_channels.sql` (empty).

- [ ] **Step 2: Write the migration SQL into that new file**

Open the file created in Step 1 and set its full contents to:

```sql
-- channels: one row per creator channel. v1 has a single owner channel,
-- but the schema supports many.
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create index channels_owner_user_id_idx on public.channels (owner_user_id);

alter table public.channels enable row level security;

-- Anyone (including anonymous) may read channels — channel pages are public.
create policy "channels are publicly readable"
  on public.channels
  for select
  using (true);

-- A user may create a channel only for themselves.
create policy "users can create their own channel"
  on public.channels
  for insert
  to authenticated
  with check (owner_user_id = (select auth.uid()));

-- A user may update only their own channel.
create policy "users can update their own channel"
  on public.channels
  for update
  to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

-- A user may delete only their own channel.
create policy "users can delete their own channel"
  on public.channels
  for delete
  to authenticated
  using (owner_user_id = (select auth.uid()));
```

- [ ] **Step 3: Apply the migration to the local DB**

```bash
supabase migration up
```

Expected: reports the `channels` migration applied. (If it says "no migrations to apply", confirm the file is non-empty and re-run.)

- [ ] **Step 4: Check advisors for security/performance issues**

```bash
supabase db advisors
```

Expected: no ERROR-level findings for `channels`. (If your CLI predates `db advisors`, skip — RLS is already enabled, which is the key check.)

- [ ] **Step 5: Generate TypeScript types from the schema**

```bash
supabase gen types typescript --local > utils/supabase/types.ts
```

Expected: `utils/supabase/types.ts` now contains a `Database` type including `public.channels`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations utils/supabase/types.ts
git commit -m "feat: add channels table with RLS and generate DB types"
```

---

## Task 7: RLS integration test for `channels`

This is a TDD task: write the test, watch it pass against the policies from Task 6 (the policies ARE the implementation; the test verifies them).

**Files:**
- Create: `tests/integration/rls-channels.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function makeUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "password123",
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!;
}

async function signedInClient(email: string) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: "password123",
  });
  if (error) throw error;
  return client;
}

describe("channels RLS", () => {
  let userAId: string;

  beforeAll(async () => {
    const a = await makeUser(`a_${Date.now()}@test.local`);
    userAId = a.id;
  });

  it("anonymous can read channels", async () => {
    const anon = createClient(url, anonKey);
    const { error } = await anon.from("channels").select("*");
    expect(error).toBeNull();
  });

  it("a user can create a channel for themselves", async () => {
    const client = await signedInClient(
      (await admin.auth.admin.getUserById(userAId)).data.user!.email!,
    );
    const { error } = await client.from("channels").insert({
      owner_user_id: userAId,
      slug: `slug_${Date.now()}`,
      name: "User A channel",
    });
    expect(error).toBeNull();
  });

  it("a user cannot create a channel owned by someone else", async () => {
    const other = await makeUser(`b_${Date.now()}@test.local`);
    const client = await signedInClient(
      (await admin.auth.admin.getUserById(userAId)).data.user!.email!,
    );
    const { error } = await client.from("channels").insert({
      owner_user_id: other.id, // not the signed-in user
      slug: `slug_${Date.now()}_x`,
      name: "Should fail",
    });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test**

Ensure local Supabase is running (`supabase status`), then:

```bash
npm test -- tests/integration/rls-channels.test.ts
```

Expected: all three tests PASS. The third passing confirms the `with check` policy blocks cross-user inserts.

- [ ] **Step 3: If the cross-user test does NOT fail the insert**, the RLS policy is wrong. Re-read Task 6 Step 2 and confirm the insert policy's `with check (owner_user_id = (select auth.uid()))` is present and applied (`supabase migration up`). Fix, re-run.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/rls-channels.test.ts
git commit -m "test: verify channels RLS allows public read and blocks cross-user writes"
```

---

## Task 8: `requireUser` server auth helper

**Files:**
- Create: `lib/auth.ts`

- [ ] **Step 1: Create `lib/auth.ts`**

```ts
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

// Returns the authenticated user's claims, or redirects to /login.
// Uses getClaims() — the trustworthy server-side check.
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/login");
  }
  return claims;
}

// Non-redirecting variant for pages that render differently when logged out.
export async function getOptionalUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: add requireUser/getOptionalUser server auth helpers"
```

---

## Task 9: Signup flow

**Files:**
- Create: `app/(auth)/signup/page.tsx`, `app/(auth)/signup/actions.ts`

- [ ] **Step 1: Create the signup server action `app/(auth)/signup/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function signup(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/");
}
```

- [ ] **Step 2: Create the signup page `app/(auth)/signup/page.tsx`**

```tsx
import { signup } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-4 text-2xl font-semibold">Sign up</h1>
      {error && <p className="mb-4 text-red-600">{error}</p>}
      <form action={signup} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded border p-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          minLength={6}
          className="rounded border p-2"
        />
        <button className="rounded bg-black p-2 text-white" type="submit">
          Create account
        </button>
      </form>
      <p className="mt-4 text-sm">
        Have an account?{" "}
        <a className="underline" href="/login">
          Log in
        </a>
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Disable email confirmation for local dev**

In `supabase/config.toml`, under `[auth.email]`, set:

```toml
enable_confirmations = false
```

Then restart so the setting takes effect:

```bash
supabase stop && supabase start
```

Expected: signup will create an immediately-usable session locally. (In production you may re-enable confirmations — out of P1 scope.)

- [ ] **Step 4: Manual smoke check**

```bash
npm run dev
```

Visit `http://localhost:3000/signup`, submit a new email + password. Expected: redirected to `/`. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/signup" supabase/config.toml
git commit -m "feat: add email/password signup"
```

---

## Task 10: Login + logout flows

**Files:**
- Create: `app/(auth)/login/page.tsx`, `app/(auth)/login/actions.ts`, `app/auth/signout/route.ts`

- [ ] **Step 1: Create the login server action `app/(auth)/login/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/");
}
```

- [ ] **Step 2: Create the login page `app/(auth)/login/page.tsx`**

```tsx
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-4 text-2xl font-semibold">Log in</h1>
      {error && <p className="mb-4 text-red-600">{error}</p>}
      <form action={login} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded border p-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          className="rounded border p-2"
        />
        <button className="rounded bg-black p-2 text-white" type="submit">
          Log in
        </button>
      </form>
      <p className="mt-4 text-sm">
        No account?{" "}
        <a className="underline" href="/signup">
          Sign up
        </a>
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Create the sign-out route `app/auth/signout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/login" app/auth/signout
git commit -m "feat: add login and logout"
```

---

## Task 11: Nav with auth state

**Files:**
- Create: `components/nav.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create `components/nav.tsx`**

```tsx
import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";

export default async function Nav() {
  const user = await getOptionalUser();
  return (
    <nav className="flex items-center justify-between border-b p-4">
      <Link href="/" className="font-semibold">
        vids.tube
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {user ? (
          <form action="/auth/signout" method="post">
            <button className="underline" type="submit">
              Sign out
            </button>
          </form>
        ) : (
          <>
            <Link className="underline" href="/login">
              Log in
            </Link>
            <Link className="underline" href="/signup">
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Render `Nav` in `app/layout.tsx`**

Replace the body contents of the root layout so it wraps children with the nav. The full file:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/nav";

export const metadata: Metadata = {
  title: "vids.tube",
  description: "Community-driven video platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/nav.tsx app/layout.tsx
git commit -m "feat: add nav reflecting auth state"
```

---

## Task 12: E2E test — signup, logout, login

**Files:**
- Create: `tests/e2e/auth.spec.ts`

- [ ] **Step 1: Write the E2E test**

```ts
import { test, expect } from "@playwright/test";

test("user can sign up, sign out, and log back in", async ({ page }) => {
  const email = `e2e_${Date.now()}@test.local`;
  const password = "password123";

  // Sign up
  await page.goto("/signup");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  // Sign out
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();

  // Log back in
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});
```

- [ ] **Step 2: Run the E2E test**

Ensure local Supabase is running. Then:

```bash
npm run test:e2e -- tests/e2e/auth.spec.ts
```

Expected: PASS. (Playwright will start the dev server per `playwright.config.ts`.)

- [ ] **Step 3: If it fails on the sign-out button not appearing**, the most likely cause is email confirmation still enabled — re-check Task 9 Step 3 (`enable_confirmations = false`) and that you restarted Supabase. Fix, re-run.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/auth.spec.ts
git commit -m "test: e2e signup/logout/login flow"
```

---

## Task 13: Public channel page

**Files:**
- Create: `app/[channelSlug]/page.tsx`

- [ ] **Step 1: Create the channel page `app/[channelSlug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ channelSlug: string }>;
}) {
  const { channelSlug } = await params;
  const supabase = await createClient();
  const { data: channel } = await supabase
    .from("channels")
    .select("name, description, slug")
    .eq("slug", channelSlug)
    .maybeSingle();

  if (!channel) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold">{channel.name}</h1>
      {channel.description && (
        <p className="mt-2 text-gray-600">{channel.description}</p>
      )}
      <p className="mt-8 text-sm text-gray-400">No videos yet.</p>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/[channelSlug]"
git commit -m "feat: add public channel page"
```

---

## Task 14: Seed the owner channel (local dev)

**Files:**
- Create: `supabase/seed.sql`
- Modify: `supabase/config.toml` (ensure seed runs on reset)

- [ ] **Step 1: Confirm seeding is enabled in `supabase/config.toml`**

Ensure the `[db.seed]` section exists and points at the seed file (this is the CLI default):

```toml
[db.seed]
enabled = true
sql_paths = ["./seed.sql"]
```

- [ ] **Step 2: Create `supabase/seed.sql`**

This creates an owner auth user and their channel for local dev. (`gen_salt`/`crypt` are available via the `pgcrypto` extension that Supabase enables by default.)

```sql
-- Local-dev owner account: owner@vids.tube / password123
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'owner@vids.tube',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}'
)
on conflict (id) do nothing;

-- An identities row is required for password sign-in to work in current GoTrue.
insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  created_at, updated_at, last_sign_in_at
)
values (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"owner@vids.tube","email_verified":true,"phone_verified":false}',
  'email',
  now(), now(), now()
)
on conflict (provider_id, provider) do nothing;

insert into public.channels (id, owner_user_id, slug, name, description)
values (
  '00000000-0000-0000-0000-0000000000aa',
  '00000000-0000-0000-0000-000000000001',
  'owner',
  'Owner Channel',
  'The first channel on vids.tube.'
)
on conflict (id) do nothing;
```

- [ ] **Step 3: Reset the local DB to apply migrations + seed**

```bash
supabase db reset
```

Expected: re-runs all migrations, then the seed. No errors.

- [ ] **Step 4: Verify the channel page renders the seeded channel**

```bash
npm run dev
```

Visit `http://localhost:3000/owner`. Expected: "Owner Channel" heading + description + "No videos yet." Stop the server.

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql supabase/config.toml
git commit -m "chore: seed local owner account and channel"
```

---

## Task 15: E2E test — public channel page

**Files:**
- Create: `tests/e2e/channel-page.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from "@playwright/test";

test("public channel page renders the seeded owner channel", async ({
  page,
}) => {
  await page.goto("/owner");
  await expect(
    page.getByRole("heading", { name: "Owner Channel" }),
  ).toBeVisible();
  await expect(page.getByText("No videos yet.")).toBeVisible();
});

test("unknown channel returns 404", async ({ page }) => {
  const res = await page.goto("/this-channel-does-not-exist");
  expect(res?.status()).toBe(404);
});
```

- [ ] **Step 2: Run it**

```bash
npm run test:e2e -- tests/e2e/channel-page.spec.ts
```

Expected: both tests PASS. (Requires the seed from Task 14 — run `supabase db reset` if the owner channel is missing.)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/channel-page.spec.ts
git commit -m "test: e2e public channel page render and 404"
```

---

## Task 16: Run the full test suite

- [ ] **Step 1: Run unit/integration tests**

```bash
npm test
```

Expected: `tests/integration/rls-channels.test.ts` passes.

- [ ] **Step 2: Run E2E tests**

```bash
npm run test:e2e
```

Expected: `auth.spec.ts` and `channel-page.spec.ts` pass.

- [ ] **Step 3: Typecheck + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: green test suite for P1 foundation"
```

(Skip if nothing changed.)

---

## Task 17: Deploy — hosted Supabase + Vercel (ops)

This task is operational (not TDD). It links the local project to a hosted Supabase project and deploys the app to Vercel.

**Files:** none (configuration in dashboards).

- [ ] **Step 1: Create a hosted Supabase project**

In the Supabase dashboard, create a new project. Note the project ref, the project URL, the **publishable key**, and the **service_role key** (Project Settings → API).

- [ ] **Step 2: Link the CLI and push migrations**

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Expected: the `channels` migration is applied to the hosted database. (Do NOT run `seed.sql` against production — the seed is for local dev only.)

- [ ] **Step 3: Create the production owner account + channel**

In the hosted dashboard: Authentication → Add user (create your real owner email/password). Then in the SQL editor, insert your channel row referencing that user's id:

```sql
insert into public.channels (owner_user_id, slug, name, description)
values ('<your-auth-user-id>', 'owner', 'Owner Channel', 'The first channel on vids.tube.');
```

- [ ] **Step 4: Deploy to Vercel**

Import the GitHub repo in Vercel. Set environment variables in the Vercel project (Production + Preview):

```
NEXT_PUBLIC_SUPABASE_URL=<hosted project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<hosted publishable key>
```

(Do NOT set `SUPABASE_SERVICE_ROLE_KEY` in Vercel for P1 — no server code needs it yet. Add it later only when a server task requires admin access.)

- [ ] **Step 5: Verify production**

Visit the deployed URL. Expected: home page loads, `/login` and `/signup` work, `/owner` shows the channel. Sign up a test account and confirm sign-out/login.

- [ ] **Step 6: Point the domain**

In Vercel, add `vids.tube` as a custom domain and follow the DNS instructions. Expected: the site resolves at `https://vids.tube`.

---

## Definition of Done (P1)

- `npm test`, `npm run test:e2e`, `npx tsc --noEmit`, and `npm run lint` all pass locally.
- A user can sign up, log out, and log back in.
- `/owner` renders the seeded channel; unknown slugs 404.
- RLS: channels are publicly readable; users cannot write channels they don't own (verified by integration test).
- The app is deployed to Vercel against a hosted Supabase project, reachable at `vids.tube`.

## Notes for the next plan (P2)

P2 (video pipeline) is independent of P1 and can start in parallel. P3 (VOD playback) will add `streams` and `videos` tables and depends on both P1 (channels, auth) and P2 (HLS in R2). The `channels.id` foreign key and the `requireUser`/`getOptionalUser` helpers established here are the integration points later plans build on.
