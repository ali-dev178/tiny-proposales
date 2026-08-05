---
allowed-tools: Bash(git rev-parse *), Bash(git init -b main), Bash(git branch *), Bash(git status *), Bash(git ls-files *), Bash(git add *), Bash(git diff *), Bash(git log *), Bash(git remote *), Bash(git commit -m *), Bash(git push*), Read, Grep
argument-hint: "[step-number] [lowercase description]"
description: Commit and push one build step using the project's exact commit convention
---

Ship one step: $ARGUMENTS

The first token is the step number, the rest is the description. If either is missing, ask for it and stop.

The commit message is not composed from the arguments. Read the step table in `.claude/commands/step.md` and use the message it gives for this step number, exactly and verbatim. The description you were passed is a confirmation token: if it disagrees with the table, print both, say which one will be committed if the user confirms, and stop. If the step number is not in the table, stop — there is no ninth step.

`git log --oneline` is the interview walkthrough, so the message stays one line, all lowercase, no trailing period, no type prefix, no body beyond the trailer below, and no reference to `plan/` or its contents.

## Refuse

State the refusal and do nothing else if this step would need `git commit --amend`, `git rebase`, a squash, `git reset`, `git push --force`, or `--no-verify`. A wrong message that is already pushed gets a follow-up commit, never a rewrite.

Also refuse to deploy: pushing to `main` is the deploy, via the Vercel GitHub integration. Never run `vercel deploy`.

## Preflight

Any failure stops the command. Report which check failed.

0. `git remote -v` is non-empty. If it is empty, stop here — before committing anything. Without the GitHub remote there is no deploy, and creating the repo is the user's call.
1. `git branch --show-current` is `main`. If `git rev-parse --git-dir` fails there is no repo: run `git init -b main`. If the branch exists under another name (`create-next-app`'s `git init` honours `init.defaultBranch`), run `git branch -M main`.
2. `.gitignore` still contains a `plan/` line - read it and confirm. `create-next-app` overwrites `.gitignore`, so this is re-checked on every ship, not once.
3. `git ls-files plan` prints nothing. If it prints anything, `plan/` is already tracked: stop and say so. Untracking it rewrites what is committed, so it needs the user's decision.
4. `git add -A`, then `git diff --cached --name-only`. Stop if that list contains `plan/`, `.env`, `.env.local`, `.vercel`, `node_modules/`, or `db-query.mjs`.
5. Something is actually staged. Stop if the tree was clean.
6. `/check` passed for this exact tree in this session, or reported `not scaffolded - gate skipped`. If it did neither, say so and stop - do not run the build here, that is `/check`'s job, and do not push red code.

If the staged diff plainly spans more than the step named in the arguments, say what else is in it and let the user split it rather than committing a mixed step.

## Commit and push

```
git commit -m "step <N>: <message from the step.md table>" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

On the first push of the branch use `git push -u origin main`.

## Report

Two lines, nothing else:

- the `git log --oneline -1` line;
- if the push succeeded, that it has triggered a Vercel deploy. If the push failed, say exactly that the step is committed locally but not pushed, and that no deploy has been triggered. Do not claim a deploy you did not observe.
