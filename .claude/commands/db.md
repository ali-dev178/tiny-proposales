---
allowed-tools: Bash, Read, Write
description: Inspect the Neon Postgres database — verify DATABASE_URL, describe tables, run a read-only query
argument-hint: "[question or SELECT statement]"
---

Answer this against the Neon database: $ARGUMENTS

## The rule that outranks the request

Never print, echo, `cat`, log, or interpolate the value of `DATABASE_URL`. It does not appear in a command argument, a script file, your output, or the transcript. Every connection reads it from the environment. If you cannot run a query without exposing it, you do not run the query.

Never open `.env.local` with the Read tool either — the presence check below is the only permitted way to look at it.

## 1. Preflight

Confirm the key is present without reading it back:

```powershell
Select-String -Path .env.local -Pattern '^DATABASE_URL=' -Quiet   # PowerShell
```
```bash
grep -q '^DATABASE_URL=' .env.local && echo present                # Git Bash
```

Missing file or missing key — stop and tell the user to run `vercel env pull .env.local` (preceded by `vercel link` if the project is not linked yet). Do not reconstruct the URL from `.vercel/`, do not ask the user to paste it, do not fall back to a hardcoded connection string.

## 2. Run the query

Write the query to `db-query.mjs` at the repo root, run it, then delete it. The file has to sit inside the repo so the driver resolves; `--env-file` is what keeps the connection string off the command line. `db-query.mjs` is in `.gitignore`, so an interrupted run cannot leak it into a commit — deleting it is hygiene, not the safety net.

```js
// db-query.mjs — scratch, never committed
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
console.table(await sql`select id, event_name, status, version from proposals order by created_at desc limit 20`);
```

```bash
node --env-file=.env.local db-query.mjs
```

Delete it in the same turn. It is untracked scratch — never `git add` it, and never let it survive into a commit.

Describing the tables:

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position
```

A share link to test the buyer page with:

```sql
select share_token from proposals order by created_at desc limit 1
```

## 3. What this command will not do

- **Read-only.** `select`, `explain`, `information_schema`. Refuse `insert`, `update`, `delete`, `truncate`, `drop`, `alter`, `create`, `grant` — unless the user asks for that exact write in this invocation, in which case state the statement you will run and get a yes first. Never a bare `update` or `delete` without a `where`.
- **No DDL here.** The schema is authored in the Neon SQL editor (build plan, step 2) so it lives in one auditable place. Print the DDL for the user to paste; do not execute it.

## 4. Reading the results

`unit_price_minor` is an integer in minor units (öre). Divide by 100 for display only — never write a float back into the column, and never compute a total in floating point.
