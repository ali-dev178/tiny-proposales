#!/bin/sh
# PreToolUse guard for Bash and PowerShell: refuse to install an ORM (CLAUDE.md
# non-negotiable #1). Only a segment that both invokes a package manager and
# names an ORM is blocked; reading and discussing ORMs is left alone.
#
# POSIX sh, no jq (not guaranteed on Windows). Invoked as `sh <path>` from
# settings.json, so the executable bit is irrelevant and chmod is not needed.

input=$(cat)

# Pull tool_input.command out of the hook payload by hand. Escaped quotes inside
# the command (the project commits with -m "step N: ...") are folded to a
# placeholder first, so the value is not truncated at the first one.
case "$input" in
  *'"command"'*) ;;
  *) exit 0 ;;
esac
PH='__ESCQ__'
rest=${input#*'"command"'}
rest=${rest#*:}
rest=${rest#*'"'}
rest=$(printf '%s' "$rest" | sed "s/\\\\\"/$PH/g")
cmd=${rest%%'"'*}
cmd=$(printf '%s' "$cmd" | sed "s/$PH/\"/g")
[ -n "$cmd" ] || exit 0

lower=$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]')

# Judge each shell segment separately, so `grep drizzle docs && npm i drizzle-orm`
# is caught on its second half rather than excused by its first.
set -f
IFS='
'
offender=
for seg in $(printf '%s' "$lower" | tr '&|;' '\n\n\n'); do
  case "$seg" in *[!\ ]*) ;; *) continue ;; esac

  # A trailing comment is annotation, not an argument: `npm i zod # not drizzle`.
  seg=${seg%%#*}

  # Inspecting or quoting an install command is not installing one.
  case "$(printf '%s' "$seg" | awk '{ print $1; exit }')" in
    grep|rg|egrep|fgrep|cat|head|tail|less|more|find|ls|echo|printf|sed|awk|git|\
    select-string|get-content|get-childitem|write-output|write-host) continue ;;
  esac

  case "$seg" in
    *"npm install"*|*"npm i "*|*"npm add"*|*"npm ci"*|*"npm exec"*|\
    *"pnpm add"*|*"pnpm install"*|*"pnpm i "*|*"pnpm dlx"*|*"pnpm exec"*|\
    *"yarn add"*|*"yarn install"*|*"yarn dlx"*|\
    *"bun add"*|*"bun install"*|*"bun i "*|*bunx*|*npx*) ;;
    *) continue ;;
  esac

  case "$seg" in
    *prisma*|*drizzle*|*kysely*|*typeorm*|*sequelize*|*knex*|*mikro-orm*)
      offender=$seg
      break ;;
  esac
done

[ -n "$offender" ] || exit 0

cat >&2 <<EOF
Blocked: that command installs an ORM.

  $cmd

tiny-proposales queries Postgres with raw SQL through @neondatabase/serverless
tagged templates; lib/db.ts is the whole data layer, and that is the point of the
exercise. Write the query instead:

  const rows = await sql\`select id, share_token, hotel_name, event_name, status from proposals order by created_at desc\`;

Reading about or discussing an ORM is fine. Only installing one is blocked.
EOF
exit 2
