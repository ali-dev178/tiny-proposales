import { notFound } from "next/navigation";
import { sql, type ProposalStatus } from "@/lib/db";

// A proposal contains prices. Public-by-link is not the same as public to
// Google, so this route is never indexed.
export const metadata = { robots: { index: false, follow: false } };

type Row = {
  hotel_name: string;
  event_name: string;
  guest_count: number | null;
  status: ProposalStatus;
  version: number;
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Looked up by share_token, never by id: the token is the only thing
  // guarding this page, and there is no login.
  const rows = (await sql`
    select hotel_name, event_name, guest_count, status, version
    from proposals
    where share_token = ${token}
    limit 1
  `) as Row[];

  const proposal = rows[0];
  if (!proposal) notFound();

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-4">
      <h1 className="text-2xl font-bold">{proposal.event_name}</h1>
      <p className="text-gray-600">
        {proposal.hotel_name} · {proposal.guest_count ?? "?"} guests
      </p>
      {proposal.status === "accepted" && (
        <p className="text-green-700 font-medium">Accepted — thank you.</p>
      )}
    </main>
  );
}
