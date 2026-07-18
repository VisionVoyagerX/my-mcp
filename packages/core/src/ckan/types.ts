import { z } from "zod";

/**
 * data.gov.gr runs a standard CKAN Action API (api/3/action/*). CKAN's
 * response envelope and dataset ("package") shape are a stable, widely
 * documented open-source standard, so these schemas are higher-confidence
 * than the bespoke gov services — but the specific data.gov.gr deployment
 * has not been live-verified from this environment (see CLAUDE.md network
 * caveat). `.loose()` throughout so extra/renamed fields degrade gracefully.
 *
 * `.nullish()` (not just `.optional()`) on string fields: CKAN's Action API
 * returns `null` for absent optional fields rather than omitting them, live-
 * confirmed 2026-07-18 when `license_title: null` failed validation under
 * `.optional()`.
 */
export const CkanResourceSchema = z
  .object({
    id: z.string().nullish(),
    name: z.string().nullish(),
    format: z.string().nullish(),
    url: z.string().nullish(),
  })
  .loose();

export const CkanOrganizationSchema = z
  .object({
    name: z.string().nullish(),
    title: z.string().nullish(),
  })
  .loose();

export const CkanDatasetSchema = z
  .object({
    id: z.string().nullish(),
    name: z.string().nullish(),
    title: z.string().nullish(),
    notes: z.string().nullish(),
    license_title: z.string().nullish(),
    organization: CkanOrganizationSchema.nullish(),
    resources: z.array(CkanResourceSchema).default([]),
    tags: z.array(z.object({ name: z.string().nullish() }).loose()).default([]),
    metadata_created: z.string().nullish(),
    metadata_modified: z.string().nullish(),
  })
  .loose();

export type CkanDataset = z.infer<typeof CkanDatasetSchema>;

export const CkanEnvelopeSchema = <T extends z.ZodTypeAny>(result: T) =>
  z
    .object({
      success: z.boolean(),
      // Omitted by CKAN entirely on error responses, so this must stay
      // optional even though a successful response always includes it.
      result: result.optional(),
      error: z
        .object({ message: z.string().optional() })
        .loose()
        .optional(),
    })
    .loose();

export const CkanSearchResultSchema = z
  .object({
    count: z.number().default(0),
    results: z.array(CkanDatasetSchema).default([]),
  })
  .loose();

export type CkanSearchResult = z.infer<typeof CkanSearchResultSchema>;
