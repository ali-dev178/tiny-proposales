"use client";

import { useActionState } from "react";
import { createProposal, type CreateProposalState } from "./actions";
import { parseEnquiry, type ParseEnquiryState } from "./actions-ai";

function Field({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 w-28">{label}</span>
      {value === null ? (
        <span className="text-amber-700">not stated</span>
      ) : (
        <span>{value}</span>
      )}
    </div>
  );
}

export function NewProposalForm() {
  const [createState, createAction, creating] = useActionState<
    CreateProposalState | undefined,
    FormData
  >(createProposal, undefined);

  const [parseState, parseAction, parsing] = useActionState<
    ParseEnquiryState | undefined,
    FormData
  >(parseEnquiry, undefined);

  const enquiry =
    parseState && "enquiry" in parseState ? parseState.enquiry : null;

  return (
    <div className="space-y-4">
      <form action={parseAction} className="border rounded p-4 space-y-2">
        <label className="text-sm text-gray-600" htmlFor="emailBody">
          Paste an enquiry email to pre-fill the form
        </label>
        <textarea
          id="emailBody"
          name="emailBody"
          rows={4}
          className="border p-2 w-full"
        />
        {parseState && "error" in parseState && (
          <p className="text-red-600 text-sm">{parseState.error}</p>
        )}
        <button disabled={parsing} className="border px-4 py-2 rounded">
          {parsing ? "Reading…" : "Read enquiry"}
        </button>
      </form>

      {enquiry && (
        <div className="border rounded p-4 space-y-1 text-sm">
          <p className="font-medium">
            Extracted · confidence {enquiry.confidence}
          </p>
          <Field label="Event" value={enquiry.eventType} />
          <Field label="Arrival" value={enquiry.arrivalDate} />
          <Field label="Nights" value={enquiry.nights} />
          <Field label="Guests" value={enquiry.guestCount} />
          <p className="text-gray-500 pt-1">
            Check these before creating the proposal. Nothing is saved until you do.
          </p>
        </div>
      )}

      {/* key remounts the form so defaultValue picks up a new extraction */}
      <form
        key={enquiry ? JSON.stringify(enquiry) : "blank"}
        action={createAction}
        className="border rounded p-4 space-y-2"
      >
        <input
          name="hotelName"
          placeholder="Hotel"
          className="border p-2 w-full"
        />
        <input
          name="eventName"
          placeholder="Event"
          defaultValue={enquiry?.eventType ?? ""}
          className="border p-2 w-full"
        />
        <input
          name="guestCount"
          placeholder="Guests (optional)"
          type="number"
          defaultValue={enquiry?.guestCount ?? ""}
          className="border p-2 w-full"
        />
        {createState && "error" in createState && (
          <p className="text-red-600 text-sm">{createState.error}</p>
        )}
        <button disabled={creating} className="border px-4 py-2 rounded">
          {creating ? "Saving…" : "Create proposal"}
        </button>
      </form>
    </div>
  );
}
