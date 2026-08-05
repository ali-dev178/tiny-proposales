import { neon } from "@neondatabase/serverless";

// The entire data layer. No ORM: every query in this app is a tagged template
// literal against this export, and interpolations are parameterised by the driver.
export const sql = neon(process.env.DATABASE_URL!);

// Mirrors the proposal_status enum in schema.sql. Kept as a union rather than
// `string` so a typo in a status comparison fails to compile instead of
// silently never matching.
export type ProposalStatus = "draft" | "sent" | "accepted";
