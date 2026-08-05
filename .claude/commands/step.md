---
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
description: Implement exactly one step of the build plan, hand off to /check and /ship, then stop
argument-hint: "[step-number]"
---

Implement step $ARGUMENTS of the build plan. That step, and nothing after it.

## 1. Read the step

The plan is `plan/proposalesbuildplan.html` — local only, gitignored, never committed, never quoted in the README or a commit message. If it is not on disk, stop and say so; do not reconstruct it from memory.

Locate the section boundaries, then read only the range for this step:

```bash
grep -n '<section id=' plan/proposalesbuildplan.html
```

| step | section id | minutes | commit message |
|---|---|---|---|
| 1 | `step1` | 0–10 | `step 1: next.js app router + typescript scaffold` |
| 2 | `step2` | 10–18 | `step 2: postgres schema + neon client, raw sql (no orm)` |
| 3 | `step3` | 18–28 | `step 3: server component reads postgres directly` |
| 4 | `step4` | 28–38 | `step 4: server action + zod validation, random share token` |
| 5 | `step5` | 38–46 | `step 5: public share page, token url, noindex` |
| 6 | `step5` | 46–52 | `step 6: accept with optimistic locking on version` |
| 7 | `step7` | 52–58 | `step 7: ai enquiry parser, nullable fields + confidence` |
| 8 | `step8` | 58–60 | `step 8: readme with decisions and trade-offs` |

Steps 5 and 6 share one section — read it whole, implement only the half you were asked for.

For step 1, CLAUDE.md's scaffolding instructions override the plan's `create-next-app tiny-proposales` line: this directory is already named that, so scaffold into a temp directory and move the result in.

## 2. Implement it

- Build exactly what the section specifies. No extra files, no refactor of an earlier step, no "while I'm here".
- Do not start step N+1. Do not stub it, scaffold its files, or leave a TODO pointing at it.
- The non-negotiables in CLAUDE.md outrank anything more convenient the code seems to want: no ORM, money as integer minor units, random `share_token` in public URLs, `and version = ${version}` on accept, zod inside every Server Action, every AI field nullable.
- Default Tailwind utilities only. No test suite.

## 3. Scope discipline

The plan's rule is that a step overrunning by five minutes gets dropped. You cannot see a clock, so use the proxies: you are creating files the section does not name, or you are three failed attempts deep into one problem, or you are solving something the section treats as already solved.

When that happens, stop building. Move the remainder to the README's "What I'd do next" list as a single honest line, ship what works, and report what you dropped. A recorded, deliberate omission is a correct outcome here — a half-finished step is not. Step 7 is the first thing to sacrifice; the README is the last. Never skip the commit.

## 4. Hand off to the gate

Do not commit or push here. `/ship` is the only command that commits, so the preflight and the message table are applied the same way every time.

Run `/check`. If it reports `gate green` (or `not scaffolded - gate skipped`), run `/ship <N> <the exact description from the table above>`. If it reports `gate red`, fix the cause and re-run `/check` before shipping.

`/ship`'s preflight covers the `plan/` leak check — `create-next-app` overwrites `.gitignore`, and dropping the `plan/` line would push interview prep to a public repo.

## 5. Stop

Report what you built, whether `/ship` committed it and under which message, anything you dropped, and the name of the next step. Then stop. Running `/step` again is the user's call, not yours.
