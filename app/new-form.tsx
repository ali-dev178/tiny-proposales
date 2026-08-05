"use client";

import { useActionState } from "react";
import { createProposal, type CreateProposalState } from "./actions";

export function NewProposalForm() {
  const [state, action, pending] = useActionState<
    CreateProposalState | undefined,
    FormData
  >(createProposal, undefined);

  return (
    <form action={action} className="border rounded p-4 space-y-2">
      <input
        name="hotelName"
        placeholder="Hotel"
        className="border p-2 w-full"
      />
      <input
        name="eventName"
        placeholder="Event"
        className="border p-2 w-full"
      />
      <input
        name="guestCount"
        placeholder="Guests (optional)"
        type="number"
        className="border p-2 w-full"
      />
      {state && "error" in state && (
        <p className="text-red-600 text-sm">{state.error}</p>
      )}
      <button disabled={pending} className="border px-4 py-2 rounded">
        {pending ? "Saving…" : "Create proposal"}
      </button>
    </form>
  );
}
