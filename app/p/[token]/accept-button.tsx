"use client";

import { useActionState } from "react";
import { acceptProposal, type AcceptProposalState } from "@/app/actions";

// A form rather than an onClick handler, so accepting still works with no
// JavaScript. The values are hidden inputs and therefore client-controlled -
// which is why the action validates them and re-checks the version itself.
export function AcceptButton({
  token,
  version,
}: {
  token: string;
  version: number;
}) {
  const [state, action, pending] = useActionState<
    AcceptProposalState | undefined,
    FormData
  >(acceptProposal, undefined);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="version" value={version} />
      <button disabled={pending} className="border px-4 py-2 rounded">
        {pending ? "Accepting…" : "Accept proposal"}
      </button>
      {state && "error" in state && (
        <p className="text-red-600 text-sm">{state.error}</p>
      )}
    </form>
  );
}
