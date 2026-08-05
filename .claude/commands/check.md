---
allowed-tools: Bash(node -e *), Bash(npx --no tsc --noEmit), Bash(npm run lint), Bash(npm run build), Read, Edit, Grep, Glob
description: Pre-commit gate - typecheck, lint, build; fix what fails; report honestly
---

Scripts in package.json: !`node -e "try{console.log(Object.keys(require('./package.json').scripts||{}).join(' '))}catch(e){console.log('NO_PACKAGE_JSON')}"`

If that line reads `NO_PACKAGE_JSON`, the app is not scaffolded yet. Report `not scaffolded - gate skipped` and stop. Do not create a `package.json`, `tsconfig.json`, or lint config to make the gate runnable. If one script is missing but others exist, name the missing one and run the rest.

Run the gate in this order, one command at a time, and read the whole output of each:

1. `npx --no tsc --noEmit`
2. `npm run lint`
3. `npm run build`

`--no` is deliberate: if TypeScript is not installed locally the gate must fail loudly, not stop on an install prompt.

## Fixing

Fix the cause, not the symptom. These are not fixes and are banned here: `@ts-ignore`, `@ts-nocheck`, widening a type to `any`, `eslint-disable`, deleting the failing code, `typescript.ignoreBuildErrors` or `eslint.ignoreDuringBuilds` in `next.config`, removing a script from `package.json`.

No fix may break a non-negotiable in CLAUDE.md. If the only compiling path you can see requires breaking one, stop and report the conflict instead of choosing for the user.

A `npm run build` failure that is actually a missing `DATABASE_URL` is an environment problem, not a code problem: the fix is `vercel env pull .env.local`. Never stub, mock, or delete a query to get a green build.

After any fix, re-run the gate from step 1. Re-running only the step that failed does not confirm the fix.

## Reporting

End with exactly this, and nothing above it but the failure detail:

```
typecheck  pass|FAIL
lint       pass|FAIL
build      pass|FAIL
```

For each FAIL give one line per distinct error: `file:line` and the message, stack trace trimmed. Then one verdict line: `gate green - safe to /ship` only if all three passed on a clean run after the last edit, otherwise `gate red` and what is still unresolved.
