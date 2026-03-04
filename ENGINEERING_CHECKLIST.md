# Engineering Checklist — Astrova Audit

## Before You Push to GitHub

### Code Hygiene

- **Run the full test suite and make sure nothing is broken.**
  - **FAIL** — No test suite exists. No `test` script in `package.json`, no test files anywhere. The happy path has been verified via `pnpm build` (passes cleanly), but there are zero automated tests covering auth flows, API endpoints, credit logic, or chart saving. This is a risk — any regression ships silently.
  - **Action needed:** At minimum, add integration tests for the 15 edge functions and unit tests for the critical paths (credit deduction, auth token validation, get-or-create user).

- **Run your linter and formatter.**
  - **PASS** — ESLint is configured (`eslint.config.js`) with `typescript-eslint`, `react-hooks`, and `react-refresh` plugins. `pnpm build` runs `tsc -b` before Vite, catching all type errors. No Prettier configured — the team relies on editor formatting.

- **Remove all debug statements.**
  - **PASS** — Zero `console.log` in `src/`. Zero `debugger` statements. Zero `alert()` calls. Zero `TODO`/`FIXME`/`HACK` comments in `src/` or `api/`. The only `console.error` calls are intentional error logging in `src/lib/api.ts` (lines 21, 24) and in each `api/*.ts` catch block — these are appropriate production error logging, not debug statements.

- **Check for hardcoded values.**
  - **FAIL** — The `.env` file contains real credentials and is **tracked by git** (committed in history):
    - `VITE_OPENROUTER_API_KEY=sk-or-v1-8468f...` (real API key)
    - `DATABASE_URL=postgresql://neondb_owner:npg_KHMdL01VjiQl@...` (real DB password)
    - `VITE_ADMIN_EMAILS=iammostwanted625@gmail.com` (personal email)
  - Source code itself is clean — all credentials are accessed via `process.env` / `import.meta.env`, not hardcoded.
  - Localhost references in `vite.config.ts:17` (`http://localhost:8000`) and `src/config/api.ts:2` (`http://localhost:10000` as fallback) are acceptable dev-only defaults.
  - **Action needed:** Remove `.env` from git tracking, rotate all exposed keys, add `.env` to `.gitignore`, consider using `git filter-repo` to scrub history.

- **Make sure `.gitignore` is covering what it should.**
  - **FAIL** — `.gitignore` covers `node_modules`, `dist`, `dist-ssr`, `.DS_Store`, `.vscode/*`, `.idea`, `*.local` — but **`.env` is NOT listed**. This is the single most critical gap.
  - `.env.example` exists but is outdated (still references Clerk + Supabase vars, not Neon).
  - **Action needed:** Add `.env`, `.env.local`, `.env.*.local` to `.gitignore`. Update `.env.example` to reflect the current Neon-based setup. Run `git rm --cached .env` to stop tracking it.

---

### Commit Quality

- **Write clear, descriptive commit messages.**
  - **FAIL** — The last 10 commits are all variations of "Improvements and bug fixes v1" through "v9.2". These tell a reviewer nothing. Before that: "Improvements1", "Improvements2", "Improvements". The one good commit is `660cefa feat: Add client-side Vedic engine and Astrova AI sidebar` — that's the standard to aim for.
  - **Action needed:** For the upcoming Neon migration commit, use something like: `refactor: migrate from Supabase+Clerk to Neon+NeonAuth with edge functions`.

- **Keep commits atomic.**
  - **FAIL** — The current uncommitted diff is 15 modified files + 21 new files + 1 deleted file, spanning auth rewrite, database migration, new API layer, and config changes. This is one massive change that should ideally be broken into logical commits:
    1. Add Neon packages, remove Supabase/Clerk
    2. Create edge function infrastructure (`api/_lib/`, schema)
    3. Create all edge functions
    4. Create frontend API client (`src/lib/api.ts`)
    5. Rewrite auth layer (AuthContext, auth-client)
    6. Update consuming pages (imports, labels)
  - **Pragmatic take:** Since this is a solo project and the migration is all-or-nothing (partial commits would leave a broken state), a single well-described commit is acceptable here.

- **Squash or clean up messy commits.**
  - **N/A** — Current changes are still uncommitted. The prior "Improvements v1-v9.2" history is already pushed and would need a force-push to rewrite (not recommended on main).

---

### PR Readiness

- **Review your own diff.**
  - **Pending** — Changes haven't been committed or pushed yet. Once committed, review the diff on GitHub before sharing.

- **Write a clear PR description.**
  - **Pending** — When creating the PR, include:
    - Summary: Full backend migration from Supabase to Neon PostgreSQL + Neon Auth
    - What changed: Auth system, database, 15 new edge functions, frontend API client
    - How to test: Sign up, sign in, Google OAuth, save chart, deduct credits, admin panel
    - Environment setup: New env vars needed (`DATABASE_URL`, `NEON_AUTH_BASE_URL`, `VITE_NEON_AUTH_URL`)

- **Link related issues or tickets.**
  - **N/A** — No issue tracker in use.

- **Consider breaking into smaller PRs.**
  - **FAIL (but justified)** — This is a 3,800-line diff. In a team setting, this would be nearly unreviewable. However, this is an all-or-nothing infrastructure migration on a solo project — splitting would mean merging broken intermediate states. Acceptable as-is, but the PR description needs to be thorough.

---

### Dependency and Config Checks

- **Package lockfile updated and committed.**
  - **PASS** — `package.json` updated (added `@neondatabase/neon-js`, `@neondatabase/serverless`; removed `@supabase/supabase-js`, `@clerk/clerk-react`, `@descope/react-sdk`, `@descope/node-sdk`, `@libsql/client`). `pnpm-lock.yaml` is updated (+3,202 lines in the diff). Both are staged for commit.
  - Note: `@neondatabase/neon-js` is pinned to `0.2.0-beta.1` — this is a beta version. Monitor for breaking changes.

- **Verify the build passes.**
  - **PASS** — `pnpm build` completes successfully. TypeScript compiles with zero errors. Vite bundles to 1.33 MB (with a chunk size warning — consider code-splitting later). All imports resolve correctly.

---

## When Designing a System

### Start with Requirements, Not Tools

- **What problem are you solving and for whom?**
  - Astrova is a Vedic astrology platform for users who want AI-powered birth chart analysis and astrological consultations. Target users: astrology enthusiasts who want personalized readings.

- **Functional vs. non-functional requirements?**
  - **Functional:** User auth (email + Google OAuth), birth chart generation (client-side Vedic engine), AI chat with astrology context, save/load charts, credit-based usage metering, admin panel for user/model/KB management.
  - **Non-functional:** Low latency for chart rendering (handled client-side). Reasonable API response times (<500ms). Data integrity for credits (no double-spend). Secure auth with session tokens.

- **Expected scale?**
  - Early-stage, likely <1,000 users. Neon's serverless PostgreSQL auto-scales, Vercel Edge Functions scale per-request. Current architecture handles 10K+ users without changes. The credit system and session storage would be the first bottlenecks at scale.

### Think About Data First

- **Core entities and relationships?**
  - `astrova_users` (1) → (many) `astrova_credit_log`, `astrova_saved_charts`, `astrova_chat_sessions`, `astrova_user_settings`. All FK-constrained with `ON DELETE CASCADE`. `astrova_admin_config` and `enabled_models` are global (no user FK). Clean relational model.

- **Where does data come from?**
  - Auth data: Neon Auth (Better Auth) manages user credentials, sessions, OAuth tokens. Astrova mirrors auth users into `astrova_users` via get-or-create on login.
  - Chart data: Client-side Vedic engine computes birth charts, stored as JSONB in `astrova_saved_charts`.
  - Chat data: AI responses from OpenRouter API, stored as JSONB messages array in `astrova_chat_sessions`.
  - Credits: Managed atomically via application-level deduct/add with transaction logging.

- **SQL or NoSQL?**
  - **SQL (PostgreSQL)** — correct choice. Access patterns are relational (user → their charts, user → their sessions). JSONB columns give document flexibility where needed (chart data, chat messages, settings) without sacrificing referential integrity.

- **Data growth strategy?**
  - No archiving or partitioning strategy yet. Chat sessions with large message arrays (JSONB) will be the first growth concern. At scale, consider: message pagination, session archiving after N days, or moving messages to a separate table.

### Define Boundaries and Interfaces

- **Component boundaries:**
  - **Clean separation.** Three layers: React SPA (presentation + client-side Vedic computation) → Vercel Edge Functions (API gateway + auth + business logic) → Neon PostgreSQL (persistence). No layer can skip another — the browser never talks directly to the database.

- **Communication:**
  - Browser ↔ Edge Functions: REST over HTTPS with Bearer token auth. JSON request/response.
  - Edge Functions ↔ Neon: SQL over the Neon serverless driver (HTTP-based, not persistent connections — good for edge).
  - Edge Functions ↔ Neon Auth: HTTP session validation (`/api/auth/get-session`).

- **API design:**
  - 15 edge functions with RESTful resource patterns (`/api/charts`, `/api/charts/[id]`, `/api/users`, etc.). Clean contract: `src/lib/api.ts` defines the frontend interface, edge functions define the backend. They can evolve independently as long as the JSON shapes match.

### Address Failure and Resilience

- **Service failures:**
  - If Neon is down: All API calls return 500. The frontend `apiFetch` helper returns `null` on failure — callers should (and mostly do) handle this gracefully. No retry logic or circuit breakers implemented.
  - If Neon Auth is down: `requireAuth()` in edge functions throws 401. Users can't sign in. No fallback.
  - If OpenRouter is down: AI chat fails, but chart viewing/saving still works.
  - **Gap:** No retry logic anywhere. At current scale this is fine, but worth adding for the credit deduction path (where a failed DB write after deducting could lose credits).

- **Single points of failure:**
  - Neon PostgreSQL — everything depends on it. Neon provides automatic failover and replication, so this is managed infrastructure risk, not application-level.
  - Neon Auth — all authentication depends on it. No local session cache.

- **Data consistency:**
  - Credit operations use two separate SQL statements (deduct credits + insert log). These are NOT in a transaction — a crash between them could deduct credits without logging, or vice versa. The `increment_credits` function handles the update atomically, but the log insert is separate.
  - **Action needed:** Wrap credit deduction + log insert in a transaction (Neon serverless driver supports `sql.transaction()`).

### Security from the Start

- **Authentication and authorization:**
  - **Auth: PASS** — Neon Auth (Better Auth) handles password hashing, session management, OAuth flows. Every edge function calls `requireAuth(req)` before any DB access. Tokens validated server-side against Neon Auth's session endpoint.
  - **Authz: PARTIAL** — Admin checks exist in some endpoints (users/all.ts, users/[id].ts check role), but not consistently enforced. For example: `charts.ts` only checks that the user is authenticated, not that `userId` in the request matches the authenticated user's `sub`. A user could potentially query another user's charts by sending a different `userId` parameter.
  - **Action needed:** In every endpoint that accepts a `userId` parameter, verify it matches `auth.sub` (or that the requester is an admin).

- **Input validation:**
  - **PARTIAL** — Edge functions destructure request bodies with TypeScript type assertions (`as { ... }`) but don't runtime-validate. A malformed request body won't crash (PostgreSQL will reject bad types), but there's no explicit validation layer (no Zod, no joi). SQL injection is prevented by the tagged template literal syntax of the Neon driver.
  - **Action needed:** Add runtime input validation, at minimum for user-facing endpoints.

- **Encryption, rate limiting, audit logging:**
  - **Encryption in transit:** PASS — All connections over HTTPS/SSL (`sslmode=require` on DB).
  - **Encryption at rest:** Managed by Neon (encrypted at rest by default).
  - **Rate limiting:** NONE — No rate limiting on any endpoint. A bad actor could spam `/api/credits` or `/api/sessions`.
  - **Audit logging:** Credit operations have `astrova_credit_log`. No general audit trail for admin actions (bans, role changes, config updates).

### Observability and Operations

- **Monitoring and alerting:**
  - **MINIMAL** — Each edge function has a `console.error` in its catch block with a tag (`[charts]`, `[users]`, etc.). Vercel captures these in its function logs. No structured logging, no external monitoring (Sentry, Datadog), no alerting.
  - **Action needed:** Add Sentry or similar for error tracking. Consider structured JSON logging for easier parsing.

- **Deploy and rollback:**
  - Vercel auto-deploys from git push. Rollback = revert to previous deployment in Vercel dashboard. No CI/CD pipeline, no automated checks before deploy (no tests, no lint CI). Database migrations are manual SQL — no migration tool (Drizzle, Prisma Migrate).
  - **Action needed:** Add a `neon-schema.sql` versioning strategy or adopt a migration tool.

- **Reproducibility:**
  - No request tracing (no correlation IDs). Error logs include the endpoint tag but not the request context. Reproducing a user's issue would require asking them what they did.

### Trade-offs to Articulate Clearly

- **Monolith vs. microservices:**
  - **Monolith (correct choice).** Single React SPA + edge functions in one repo. At this scale, microservices would be pure overhead. The edge function pattern gives deployment isolation without the operational complexity of separate services.

- **Build vs. buy:**
  - **Good decisions:** Using Neon Auth (not rolling own auth), OpenRouter for AI (not self-hosting LLMs), Vercel for hosting (not managing servers), Neon for PostgreSQL (not managing a database).
  - **One gap:** Credit metering is hand-rolled. Fine for now, but if payment processing is added later, use Stripe's metered billing instead of extending the custom system.

- **CAP theorem:**
  - Prioritizing **Consistency + Availability** (CP/CA). PostgreSQL provides strong consistency. Neon's serverless architecture handles availability. Partition tolerance is Neon's responsibility (managed infrastructure). For a credit-based system, strong consistency is the right choice — eventual consistency could allow double-spending.

- **Premature optimization:**
  - **Appropriately simple.** No caching layer, no CDN for API responses, no connection pooling beyond what Neon provides. The 1.33 MB bundle could be code-split, but it's not a bottleneck yet. The right things to optimize first: add the credit transaction, fix the authz gap, add `.env` to `.gitignore`.

### Questions to Ask Yourself

- **"What's the simplest version that would work?"**
  - The current architecture IS the simple version. SPA + edge functions + managed PostgreSQL. No Kubernetes, no message queues, no caching layers. Good.

- **"What will be hardest to change later?"**
  - The auth provider (Neon Auth / Better Auth). It's deeply integrated into AuthContext, all edge functions, and the session validation flow. Changing it would be another full migration. Make sure Neon Auth is the right long-term choice.
  - The database schema. Adding columns is easy; changing relationships or splitting tables is hard. The current schema is clean and well-normalized.

- **"Where will this break at 10x the current load?"**
  - Edge functions calling Neon Auth's `/api/auth/get-session` on EVERY request. At 10x load, this is 10x HTTP calls to validate sessions. Consider caching validated sessions briefly (5-minute TTL) or using JWT verification locally instead of hitting the session endpoint.
  - Chat sessions with large JSONB message arrays. Loading 1,000 messages in one SELECT is fine for 10 users, painful for 10,000.

- **"Could someone else maintain this?"**
  - **Mostly yes.** The codebase is well-organized: clear separation between `src/` (frontend), `api/` (backend), `src/lib/` (shared logic). File naming is intuitive. The `api.ts` client mirrors function names from the old `supabase.ts`, making the migration traceable.
  - **Gap:** No documentation beyond code comments. No README explaining the architecture, how to set up locally, or how the auth flow works. The `neon-schema.sql` is the closest thing to architecture documentation.

---

## Summary: Critical Actions Before Pushing

| Priority | Action | Effort |
|----------|--------|--------|
| **P0** | Add `.env` to `.gitignore`, run `git rm --cached .env` | 2 min |
| **P0** | Rotate all exposed credentials (OpenRouter key, Neon DB password) | 10 min |
| **P0** | Update `.env.example` to reflect Neon setup (remove Clerk/Supabase refs) | 5 min |
| **P1** | Add authorization checks — verify `userId` matches `auth.sub` in endpoints | 30 min |
| **P1** | Wrap credit deduction + log insert in a DB transaction | 15 min |
| **P1** | Write a meaningful commit message for this migration | 5 min |
| **P2** | Add basic integration tests for edge functions | 2-4 hrs |
| **P2** | Add rate limiting to public-facing endpoints | 1 hr |
| **P2** | Add a README with setup instructions and architecture overview | 1 hr |
| **P3** | Set up Sentry or error tracking | 30 min |
| **P3** | Code-split the 1.33 MB bundle | 30 min |

---

> The common thread across all of this — pushing code, presenting to seniors, designing systems — is **intentionality**. The best engineers aren't the ones who write the cleverest code; they're the ones who've thought through their decisions and can explain them clearly.
