"use client";

import { useActionState, useState } from "react";
import { createProposal, type CreateProposalState } from "./actions";
import { parseEnquiry, type ParseEnquiryState } from "./actions-ai";

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
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

  const [extraLines, setExtraLines] = useState(0);
  const items = enquiry?.items ?? [];
  const lineCount = Math.max(2, items.length) + extraLines;

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
          defaultValue={
            parseState && "error" in parseState ? parseState.emailBody : ""
          }
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
          <Field label="Client" value={enquiry.clientName} />
          <Field label="Event" value={enquiry.eventType} />
          <Field label="Arrival" value={enquiry.arrivalDate} />
          <Field label="Nights" value={enquiry.nights} />
          <Field label="Guests" value={enquiry.guestCount} />
          <Field
            label="Asked for"
            value={
              items.length
                ? items
                    .map((i) => (i.quantity ? `${i.quantity}× ${i.label}` : i.label))
                    .join(", ")
                : null
            }
          />
          <p className="text-gray-500 pt-1">
            Prices are never extracted — set them yourself. Check these before
            creating the proposal. Nothing is saved until you do.
          </p>
        </div>
      )}

      {/* key remounts the form so defaultValue picks up a new extraction */}
      <form
        key={enquiry ? JSON.stringify(enquiry) : "blank"}
        action={createAction}
        className="border rounded p-4 space-y-2"
      >
        {enquiry && (
          <input type="hidden" name="enquiry" value={JSON.stringify(enquiry)} />
        )}
        <div className="flex gap-2">
          <input
            name="hotelName"
            placeholder="Hotel"
            className="border p-2 flex-1 min-w-0"
          />
          <input
            name="clientName"
            placeholder="Client (optional)"
            defaultValue={enquiry?.clientName ?? ""}
            className="border p-2 flex-1 min-w-0"
          />
        </div>
        <input
          name="eventName"
          placeholder="Event"
          defaultValue={enquiry?.eventType ?? ""}
          className="border p-2 w-full"
        />
        <div className="flex gap-2">
          <input
            name="guestCount"
            placeholder="Guests (optional)"
            type="number"
            defaultValue={enquiry?.guestCount ?? ""}
            className="border p-2 flex-1 min-w-0"
          />
          <input
            name="arrivalDate"
            type="date"
            defaultValue={enquiry?.arrivalDate ?? ""}
            className="border p-2 flex-1 min-w-0"
          />
          <input
            name="nights"
            placeholder="Nights"
            type="number"
            defaultValue={enquiry?.nights ?? ""}
            className="border p-2 w-24"
          />
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-sm text-gray-600">
            Line items — prices in whole currency units, e.g. 1250.00
          </p>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="flex gap-2">
              <input
                name="itemLabel"
                placeholder="Description"
                defaultValue={items[i]?.label ?? ""}
                className="border p-2 flex-1 min-w-0"
              />
              <input
                name="itemQuantity"
                placeholder="Qty"
                type="number"
                defaultValue={items[i]?.quantity ?? 1}
                className="border p-2 w-20"
              />
              <input
                name="itemPrice"
                placeholder="Unit price"
                className="border p-2 w-28"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setExtraLines((c) => c + 1)}
            className="text-sm underline text-gray-600"
          >
            Add line
          </button>
        </div>

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
