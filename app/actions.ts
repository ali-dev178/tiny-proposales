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
