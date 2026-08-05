import Link from "next/link";
import { sql, type ProposalStatus } from "@/lib/db";
import { NewProposalForm } from "./new-form";

type Row = {
  id: string;
  share_token: string;
  hotel_name: string;
  event_name: string;
  guest_count: number | null;
  status: ProposalStatus;
};

// Async Server Component: this queries Postgres directly. There is no API
// route in between, and no JavaScript for this page reaches the browser.
export default async function Home() {
  const rows = (await sql`
    select id, share_token, hotel_name, event_name, guest_count, status
    from proposals
    order by created_at desc
    limit 50
  `) as Row[];

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-8">
      <h1 className="text-2xl font-bold">Proposals</h1>
      <NewProposalForm />

      {rows.length === 0 ? (
        <p className="text-gray-500">No proposals yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => (
            <li key={p.id} className="border rounded p-3">
              <Link href={`/p/${p.share_token}`} className="underline">
                {p.event_name}
              </Link>
              <span className="text-sm text-gray-500">
                {" "}
                — {p.hotel_name} · {p.guest_count ?? "?"} guests · {p.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
