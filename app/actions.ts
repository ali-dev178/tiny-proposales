"use server";

import { randomBytes, randomUUID } from "node:crypto";
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

// "1250.50" -> 125050, by string arithmetic rather than `* 100`. Floating
// point multiplication is the exact bug that storing minor units avoids:
// 1250.55 * 100 === 125054.99999999999.
const MoneyMinor = z
  .string()
  .trim()
  .regex(/^\d{1,7}(\.\d{1,2})?$/)
  .transform((s) => {
    const [whole, frac = ""] = s.split(".");
    return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  });

const LineItem = z.object({
  label: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().positive().max(10000),
  unitPriceMinor: MoneyMinor,
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

  // Line items arrive as parallel arrays, so getAll rather than
  // Object.fromEntries, which keeps only the last value of a repeated name.
  const labels = formData.getAll("itemLabel").map(String);
  const quantities = formData.getAll("itemQuantity").map(String);
  const prices = formData.getAll("itemPrice").map(String);

  const items: z.infer<typeof LineItem>[] = [];
  for (let i = 0; i < labels.length; i++) {
    const raw = {
      label: labels[i] ?? "",
      quantity: quantities[i] ?? "",
      unitPriceMinor: prices[i] ?? "",
    };
    // An unused row is not an error. Quantity is ignored in this test because
    // it carries a default of 1, so an untouched row still has a value there.
    if (raw.label.trim() === "" && raw.unitPriceMinor.trim() === "") continue;

    const item = LineItem.safeParse(raw);
    if (!item.success) {
      return {
        error: "Each line needs a description, a whole quantity, and a price like 1250.00.",
      };
    }
    items.push(item.data);
  }

  // 128 bits of randomness. A sequential id would make /p/2 someone else's
  // proposal; this token is the only thing guarding the share link.
  const token = randomBytes(16).toString("base64url");

  // The id is generated here rather than by the database so the proposal and
  // its lines go in as one transaction. A proposal that saved without its
  // prices would be worse than one that failed outright.
  const id = randomUUID();

  await sql.transaction([
    sql`
      insert into proposals (id, share_token, hotel_name, event_name, guest_count, status)
      values (${id}, ${token}, ${hotelName}, ${eventName}, ${guestCount ?? null}, 'sent')
    `,
    ...items.map(
      (it, i) => sql`
        insert into line_items (proposal_id, position, label, quantity, unit_price_minor)
        values (${id}, ${i}, ${it.label}, ${it.quantity}, ${it.unitPriceMinor})
      `,
    ),
  ]);

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
