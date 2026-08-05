"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";

// A Server Action compiles to a public HTTP endpoint. Its arguments are
// attacker-controlled and the page that rendered the form is not a security
// boundary, so the action validates its own input.
const NewProposal = z.object({
  hotelName: z.string().trim().min(1).max(120),
  eventName: z.string().trim().min(1).max(120),
  // An empty field arrives as "", which coerces to 0 and would fail
  // .positive(). guest_count is nullable: blank means "not stated".
  guestCount: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce.number().int().positive().max(10000).optional(),
  ),
});

export type CreateProposalState = { ok: true } | { error: string };

export async function createProposal(
  _prev: CreateProposalState | undefined,
  formData: FormData,
): Promise<CreateProposalState> {
  const parsed = NewProposal.safeParse(Object.fromEntries(formData));
  // A flat message: returning parsed.error would leak the schema shape.
  if (!parsed.success) return { error: "Please check the fields." };

  const { hotelName, eventName, guestCount } = parsed.data;

  // 128 bits of randomness. A sequential id would make /p/2 someone else's
  // proposal; this token is the only thing guarding the share link.
  const token = randomBytes(16).toString("base64url");

  await sql`
    insert into proposals (share_token, hotel_name, event_name, guest_count, status)
    values (${token}, ${hotelName}, ${eventName}, ${guestCount ?? null}, 'sent')
  `;

  revalidatePath("/");
  return { ok: true };
}

// token and version arrive from the client, so they are validated here too.
// The token is base64url, which includes "-" and "_" - do not narrow this to
// [A-Za-z0-9] or roughly half of all valid tokens would be rejected.
const AcceptProposal = z.object({
  token: z.string().min(1).max(64),
  version: z.coerce.number().int().positive(),
});

export type AcceptProposalState = { ok: true } | { error: string };

type UpdatedRow = { id: string; version: number };

export async function acceptProposal(
  _prev: AcceptProposalState | undefined,
  formData: FormData,
): Promise<AcceptProposalState> {
  const parsed = AcceptProposal.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Something went wrong. Please reload." };

  const { token, version } = parsed.data;

  // The optimistic lock. The update is conditional on the version the buyer
  // was actually shown: if the seller changed the proposal while the buyer was
  // reading it, zero rows update and the buyer is told, rather than silently
  // accepting terms they never saw. `status != 'accepted'` makes it idempotent.
  const updated = (await sql`
    update proposals
       set status = 'accepted'
     where share_token = ${token}
       and version = ${version}
       and status != 'accepted'
    returning id, version
  `) as UpdatedRow[];

  if (updated.length === 0) {
    return {
      error: "This proposal was updated. Please reload and review the changes.",
    };
  }

  // Record which version was accepted, not merely that it was.
  await sql`
    insert into acceptances (proposal_id, proposal_version)
    values (${updated[0].id}, ${updated[0].version})
  `;

  revalidatePath(`/p/${token}`);
  return { ok: true };
}
