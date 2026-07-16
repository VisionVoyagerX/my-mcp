import { z } from "zod";

/**
 * No confirmed evidence of the GEMI company-record field names was found
 * (the Swagger UI and techdocs pages both returned 403 to automated
 * fetches from this environment) — only the base URL, endpoint paths, and
 * `api_key` header are confirmed (against github.com/firebed/vat-registry,
 * a maintained open-source client). So this schema stays intentionally
 * unopinionated: it accepts any object shape rather than asserting field
 * names it can't back up, and callers/tools should treat the record as a
 * generic key-value bag rather than assuming specific fields exist.
 */
export const GemiCompanySchema = z.record(z.string(), z.unknown());

export type GemiCompany = z.infer<typeof GemiCompanySchema>;
