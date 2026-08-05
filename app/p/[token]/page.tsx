import { notFound } from "next/navigation";
import { sql, type ProposalStatus } from "@/lib/db";
import { AcceptButton } from "./accept-button";

// A proposal contains prices. Public-by-link is not the same as public to
// Google, so this route is never indexed.
export const metadata = { robots: { index: false, follow: false } };

type Row = {
  id: string;
  hotel_name: string;
  event_name: string;
  guest_count: number | null;
  currency: string;
  status: ProposalStatus;
  version: number;
};

type ItemRow = {
  label: string;
  quantity: number;
  unit_price_minor: number;
};

// Minor units are divided only here, at the point of display. Every value
// that is stored, summed or compared stays an integer.
const money = (minor: number, currency: string) =>
  `${(minor / 100).toFixed(2)} ${currency}`;

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Looked up by share_token, never by id: the token is the only thing
  // guarding this page, and there is no login.
  const rows = (await sql`
    select id, hotel_name, event_name, guest_count, currency, status, version
    from proposals
    where share_token = ${token}
    limit 1
  `) as Row[];

  const proposal = rows[0];
  if (!proposal) notFound();

  // The id is used server-side to fetch the lines and is never rendered,
  // passed to a Client Component, or placed in a URL.
  const items = (await sql`
    select label, quantity, unit_price_minor
    from line_items
    where proposal_id = ${proposal.id}
    order by position
    limit 100
  `) as ItemRow[];

  const totalMinor = items.reduce(
    (sum, i) => sum + i.quantity * i.unit_price_minor,
    0,
  );

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-4">
      <h1 className="text-2xl font-bold">{proposal.event_name}</h1>
      <p className="text-gray-600">
        {proposal.hotel_name} · {proposal.guest_count ?? "?"} guests
      </p>
      {items.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 font-medium text-right">Qty</th>
              <th className="py-2 font-medium text-right">Unit</th>
              <th className="py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b">
                <td className="py-2">{item.label}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">
                  {money(item.unit_price_minor, proposal.currency)}
                </td>
                <td className="py-2 text-right">
                  {money(item.quantity * item.unit_price_minor, proposal.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="py-2 font-medium" colSpan={3}>
                Total
              </td>
              <td className="py-2 font-medium text-right">
                {money(totalMinor, proposal.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {proposal.status === "accepted" ? (
        <p className="text-green-700 font-medium">Accepted — thank you.</p>
      ) : (
        <AcceptButton token={token} version={proposal.version} />
      )}
    </main>
  );
}
