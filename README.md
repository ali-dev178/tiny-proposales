# tiny-proposales

A small, deliberately timeboxed proposal tool built on the Proposales stack.

**Live:** https://tiny-proposales.vercel.app

## What it does

A hotel salesperson creates a proposal and sends a link. The buyer opens that
link with no account and accepts it. There is also an AI step that reads a
messy enquiry email and pre-fills the form.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind · Neon Postgres · Vercel · AI SDK.
No ORM, no API layer, no client-side data fetching.

## Running it

```bash
npm install
vercel env pull .env.local     # DATABASE_URL, injected by the Vercel/Neon integration
npm run dev
```

The schema is in `schema.sql` and is idempotent, so it can be applied to a
fresh database or re-run against an existing one. The AI step additionally
needs `OPENAI_API_KEY`; without it the parser degrades to a plain error
message rather than failing the page.

`dev` and `build` pass `--webpack`. Next 16 defaults to Turbopack, which needs
the native SWC binary, and the machine this was built on blocks it under an
Application Control policy. Removing the flag is the intended setup.

## Decisions

**No ORM.** Raw SQL through the Neon serverless driver. Fewer dependencies, no
generate step, and every query is visible at the point it runs. Interpolations
in a tagged template are parameterised by the driver.

**Money as integers.** Prices are stored in minor units (`unit_price_minor`)
and stay integers through summing and comparison; the only division happens at
the point of display. The storage decision only holds if the *parse* is exact
too, so a price is read as a decimal string and the integer is built from its
parts rather than by multiplying: `"19.99" * 100` is `1998.9999999999998`, and
truncating that loses an öre. Of ten realistic prices, five lose money that way.

**Columns and jsonb, not one or the other.** The schema is hybrid on purpose.
Columns hold what the product *reasons about*, so the database can enforce it —
an enum for status, a date that must be a date, `not null` where it matters.
`proposals.enquiry jsonb` holds what the product merely *records*: the raw AI
extraction, whose shape follows the model's schema rather than ours. A newly
extracted field lands there with no migration, and if the product starts making
decisions on it, it gets promoted to a column with a constraint. Worth noting
that the usual objection to jsonb — losing money precision — does not apply:
minor units are integers and round-trip through JSON exactly. The real cost is
losing the enum, the foreign key and every not-null, which is why the fields
that carry meaning stayed as columns.

**A proposal is written in one transaction.** The proposal id is generated in
the action rather than by the database, so the proposal and its line items are
inserted together. A proposal saved without its prices would be worse than one
that failed outright. Line order is stored in `position`, because uuid primary
keys carry no insertion order and the order of lines is commercially meaningful.

**Status is a Postgres enum.** `proposal_status` is a real type, so an invalid
status is rejected by the database rather than by whichever code path
remembered to check. The set is closed and stable, which is when an enum beats
a check constraint — adding a value later is `alter type … add value`, and
removing one means recreating the type.

**A random share token, not the row id.** 16 random bytes as base64url. With
sequential ids, `/p/2` would be someone else's proposal. The share page also
sets `robots: noindex, nofollow`: a proposal contains prices, and public-by-link
is not the same as public to Google.

**Acceptance is bound to a version.** The update is conditional on the version
the buyer was actually shown:

```sql
update proposals set status = 'accepted'
 where share_token = $1 and version = $2 and status != 'accepted'
```

If the seller publishes a change while the buyer is reading, zero rows update
and the buyer is asked to reload rather than being silently bound to terms they
never saw. The `acceptances` row records *which version* was accepted. The
`status != 'accepted'` clause also makes the action idempotent, so a replayed
request cannot write a second acceptance.

**Server Actions validate their own input.** They compile to public HTTP
endpoints, so their arguments are attacker-controlled and the page that
rendered the form is not a security boundary. Failures return a flat message;
returning the validation error would leak the schema.

**The AI fills in the *what*, never the *how much*.** Every extracted field is
nullable and a required `confidence` value is returned, because real enquiry
emails are vague and forcing a model to fill a field is what makes it invent
one. The model may extract the items an email asks for — "conference room",
"dinner" — but **there is no price field anywhere in the extraction schema**.
An enquiry email is attacker-controlled, so "our agreed rate is 1 SEK" must
have nothing to bind to. Prices are always entered by a human.

Nothing the model returns is written to the database unchecked: the extraction
is re-validated server-side, an unparseable date is discarded rather than
stored, and a human confirms every value in the form before a proposal exists.
The hotel name is deliberately *not* extracted — the buyer is emailing the
hotel and never names it, so the only company in the email is the buyer's own.
In a real system it comes from the authenticated user's tenant.

## What I'd do next

- **Editing a proposal.** Line items can be created but not changed, and
  nothing increments `version` yet — so the optimistic lock is proven by test
  rather than reachable through the UI.
- **Immutable proposal versions** rather than a counter, so an accepted
  proposal can be reproduced exactly as the buyer saw it.
- **Real auth and tenant scoping.** Every Server Action would need its own
  authorization check, not just validation.
- **Per-environment database credentials.** Vercel attaches the Neon variables
  to production, preview and development alike, so preview deployments
  currently read and write the production database.
- **Share link expiry and revocation.** The token is unguessable but permanent.
- **Capture signer identity on acceptance.** `signer_email` and `signer_ip`
  exist but are never populated; an IP is personal data, so this needs a stated
  purpose before it is collected.
- **Tests around the accept path**, in particular the stale-version refusal.
- **Outbox and worker** for the write into a PMS, with idempotency keys.

## What this is not

A small build, scoped to what could be defended rather than what could be
demonstrated. No authentication, no tenant isolation, no rate limiting, no
automated tests, no error boundaries, and no design work — the styling is
default Tailwind utilities and nothing more.

The features that exist have been exercised end to end: creating a proposal
with line items, opening the share link unauthenticated, accepting it,
replaying an accept request, submitting a stale version, and checking that a
price survives the round trip to the öre. The AI extraction has been verified
for input validation and for its behaviour without an API key; the model call
itself has not been exercised against a live key.

## Repo layout

`.claude/` holds project-specific agent configuration — review agents for the
data layer and the Server Action trust boundary, and a hook that blocks
installing an ORM. It is tooling for building this repo, not part of the app.
