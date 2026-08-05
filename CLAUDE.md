# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

**Step 1 of 8 is done**: the Next.js app is scaffolded and the gate (typecheck, lint, build) is green. No database, no pages beyond the default, no features yet. Git is on `main` with a repo-local personal identity. Read `plan/proposalesbuildplan.html` before writing code — it specifies the schema, the file layout, and the reasoning behind each decision.

`plan/` is gitignored on purpose: it is interview prep, and the repo it produces is meant to be shown to the employer. Never commit it, never move its contents into a tracked path, and do not quote it in commit messages or the README.

The app is an interview take-home for Proposales: a hotel salesperson creates a proposal, shares a no-login link, a buyer accepts it, plus one AI step that extracts booking details from a messy enquiry email. It is deliberately one hour of scope.

## Working on the plan document

`plan/proposalesbuildplan.html` is a single file with inline CSS and JS — no build step, no dependencies. Open it directly in a browser. Two constraints when editing it:

- Code samples live in `<pre class="code">` blocks and are syntax-highlighted at runtime by the inline highlighter in the `<script>`. It **skips any block that already contains child elements** (`if (pre.children.length > 0) return;`), so hand-adding markup inside a block silently disables auto-highlighting for it.
- Because blocks are plain text, JSX inside them must be HTML-escaped (`&lt;main&gt;`, `&amp;&amp;`). Unescaped `<` will be parsed as markup and break both the block and the highlighter.

The search feature filters whole `<section>` elements by text and `details.qa` elements individually — new content should live inside a `<section id="...">` with a matching sidebar `<a href="#...">` entry, or it will not be findable or tracked by the scrollspy.

## Scaffolding the app

Already done (step 1). It was scaffolded into a temp directory and moved in, because `create-next-app .` refuses to write into a directory holding files outside its allowlist. Two things it clobbered on the way in, both restored from the `step 0` commit — **expect this again if anyone re-scaffolds**:

- **`.gitignore`** — replaced wholesale. The `plan/` line is what keeps interview prep out of a public repo. The project-specific rules are now grouped under a header at the top of the file; re-add that block if it ever disappears.
- **`CLAUDE.md`** — replaced with a one-line `@AGENTS.md` pointer. `AGENTS.md` is generated and re-added by `next dev`, so it is committed on purpose and imported from the bottom of this file rather than being allowed to replace it.

**Installed versions differ from the plan document**, which was written against Next 15: this is **Next 16.3.0 / React 19.2.8**. `AGENTS.md` warns that this Next may not match training data and points at authoritative docs vendored in `node_modules/next/dist/docs/` — read those before writing framework code rather than working from memory.

**Local builds use webpack, not Turbopack.** Next 16 defaults to Turbopack, which requires the native SWC binary, and this machine's Windows Application Control policy blocks it (`@next/swc-win32-x64-msvc` → "An Application Control policy has blocked this file"); only WASM bindings load, and Turbopack refuses to run on WASM. So `dev` and `build` carry `--webpack`. The warning is noisy but harmless. If the policy is ever lifted, dropping `--webpack` from both scripts restores the plan's intended setup.

The standard scripts apply (`npm run dev`, `npm run build`, `npm run lint`). The plan specifies **no test suite** — do not add one unless asked; "no tests" is listed as a deliberate, disclosed gap in the README. The `evaluator` agent verifies behaviour by running the app instead.

Database and deploy setup:

```bash
vercel link
vercel env pull .env.local   # pulls DATABASE_URL injected by the Vercel↔Neon integration
```

The schema DDL runs in the Neon SQL editor (see step 2 of the plan). `OPENAI_API_KEY` is set in Vercel → Settings → Environment Variables for the AI step.

## Architecture

Next.js App Router on Vercel, Neon Postgres, no API layer and no client-side data fetching.

- `lib/db.ts` — the **entire** data layer: `export const sql = neon(process.env.DATABASE_URL!)`. Every query in the app is a tagged template literal against this export.
- `app/page.tsx` — async Server Component querying Postgres directly, renders the list.
- `app/actions.ts` — `"use server"` mutations (`createProposal`, `acceptProposal`), zod-validated, ending in `revalidatePath`.
- `app/new-form.tsx` — `"use client"`, wires the form via `useActionState`.
- `app/p/[token]/page.tsx` — public buyer-facing share page, keyed by random token, `robots: { index: false, follow: false }`.
- `app/actions-ai.ts` — AI SDK `generateText` with `Output.object({ schema })` for enquiry parsing.

Three tables: `proposals`, `line_items`, `acceptances`.

`params` in a page is a `Promise` and must be awaited (`const { token } = await params`). Verified against the vendored docs for the installed version, not assumed.

## Non-negotiable decisions

These are the point of the exercise — each one is defended in the interview walkthrough, so do not "improve" them away.

- **No ORM.** Raw SQL through the Neon serverless driver. The employer's job ad says "Minimal abstractions. No ORMs." Do not introduce Prisma, Drizzle, Kysely, or a query builder.
- **Money as integers.** Prices in minor units (`unit_price_minor`, öre). Never floats.
- **Random `share_token`, never the row id, in public URLs.** Generated with `randomBytes(16).toString("base64url")`.
- **Accept is optimistically locked on `version`.** The `update ... and version = ${version}` clause must stay; if zero rows update, tell the buyer the proposal changed rather than binding them to unseen terms. The accepted version is recorded in `acceptances`.
- **Server Actions validate their own input.** They compile to public HTTP endpoints; the page that rendered the form is not a security boundary.
- **The AI never invents a value.** Every extracted field is `.nullable()`, the schema carries a `confidence` enum, and the prompt says never guess. Prices always come from the database, never from the model.
- **No design work.** Default Tailwind utility classes and plain HTML. Zero time on styling.

## Code standards

Short on purpose. These are conventions, not the non-negotiables above — but follow them so the diff reads as one person's work.

- **Type every query result.** Declare a local `Row` type mirroring the selected columns and cast with `as Row[]`. **This supersedes the plan document**, which uses `as any[]` in `app/p/[token]/page.tsx` and `acceptProposal`; type those properly instead. No `any` in committed code.
- **SQL is lowercase**, one statement per tagged template. Interpolate values only with `${}` — the Neon driver parameterises those. Never build a query by string concatenation, and never pass a concatenated string to `sql()`.
- **Every list query gets a `LIMIT`.** Unbounded selects do not ship.
- **snake_case stops at the database boundary.** Columns and `Row` fields stay snake_case (`hotel_name`, `share_token`); everything else in TypeScript is camelCase. Do not rename fields halfway through a layer — map once, at the point of use.
- **Money columns and fields carry a `_minor` suffix** and are integers end to end. Convert for display only, in the JSX that renders it.
- **Server Actions return `{ ok: true }` or `{ error: string }`** — never throw for a failure the user is meant to read. Every mutation ends with `revalidatePath`.
- **Server Components by default.** Add `"use client"` only for genuine interactivity (the create form, the accept button), and keep those leaves small.
- **Missing rows call `notFound()`**, not a redirect and not an empty render.
- **No helper layer.** `lib/db.ts` is the only file in `lib/`. Do not add utils, barrels, or wrappers; inline the logic until something is genuinely used three times.

## The .claude/ harness

Committed on purpose (only `settings.local.json` is ignored). It exists to enforce the decisions above, not to add ceremony.

| | |
|---|---|
| `/step <n>` | Implement exactly one plan step, then hand off to `/check` and `/ship`. Never commits directly. |
| `/check` | Pre-commit gate: `tsc --noEmit`, lint, build. |
| `/ship <n> <desc>` | The **only** command that commits. Resolves the message from the step table, runs the `plan/` leak preflight, pushes. |
| `/db` | Verify `DATABASE_URL`, describe tables, run a read-only query. Never prints the connection string. |
| `builder` | Implements the sequence across steps. Subagents cannot call slash commands, so it carries the gate and commit logic itself, and stops at the human handoffs (Vercel import, Neon DDL, env vars) and after step 6. |
| `sql-guard` | Data layer: ORM creep, float money, token-vs-id, the `version` predicate, injection, missing `limit`. |
| `action-auditor` | Server Action trust boundary, AI output shape, public URL surface, secrets reaching the client. |
| `security-review` | Secrets at rest, personal data in `acceptances`, prompt injection via the enquiry email, dependencies, Vercel preview env scoping. |
| `evaluator` | Runs the app and exercises create → share → accept, including the stale-version refusal. Writes no tests. |
| `plan-keeper` | Judges in-scope vs. defer-to-README. |

A `PreToolUse` hook (`.claude/hooks/no-orm.sh`) blocks any command that *installs* an ORM. It deliberately does not block reading, grepping or discussing one, and does not trip on the `step 2: ... raw sql (no orm)` commit message. `.gitattributes` pins `*.sh` to LF — a CRLF hook fails silently under Git Bash, which would disable the guard without any error.

## Commit convention

One commit per step, using the exact messages from the plan (`step 1: next.js app router + typescript scaffold`, `step 2: postgres schema + neon client, raw sql (no orm)`, …). `git log --oneline` is intended to read as the walkthrough — keep the history linear and one commit per decision rather than squashing or amending.

Deployment is the Vercel GitHub integration: every push to `main` deploys. Do not deploy via the CLI.

## Scope discipline

The plan sets a hard checkpoint: if a step overruns by 5 minutes, cut it and move it to the README's "What I'd do next" list. The AI step (step 7) is explicitly optional and should be skipped in favour of the README if time is short. When adding scope, prefer recording it in the README over building it.

# Next.js version rules (generated, re-added by `next dev`)
@AGENTS.md
