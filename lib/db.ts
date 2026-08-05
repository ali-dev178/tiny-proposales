import { neon } from "@neondatabase/serverless";

// The entire data layer. No ORM: every query in this app is a tagged template
// literal against this export, and interpolations are parameterised by the driver.
export const sql = neon(process.env.DATABASE_URL!);
