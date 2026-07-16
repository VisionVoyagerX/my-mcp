import { z } from "zod";

/**
 * data.gov.gr runs a standard CKAN Action API (api/3/action/*). CKAN's
 * response envelope and dataset ("package") shape are a stable, widely
 * documented open-source standard, so these schemas are higher-confidence
 * than the bespoke gov services — but the specific data.gov.gr deployment
 * has not been live-verified from this environment (see CLAUDE.md network
 * caveat). `.loose()` throughout so extra/renamed fields degrade gracefully.
 */
export const CkanResourceSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    format: z.string().optional(),
    url: z.string().optional(),
  })
  .loose();

export const CkanOrganizationSchema = z
  .object({
    name: z.string().optional(),
    title: z.string().optional(),
  })
  .loose();

export const CkanDatasetSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    notes: z.string().optional(),
    license_title: z.string().optional(),
    organization: CkanOrganizationSchema.optional(),
    resources: z.array(CkanResourceSchema).default([]),
    tags: z.array(z.object({ name: z.string().optional() }).loose()).default([]),
    metadata_created: z.string().optional(),
    metadata_modified: z.string().optional(),
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
