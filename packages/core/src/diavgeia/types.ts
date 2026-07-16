import { z } from "zod";

/**
 * Diavgeia's decision/search JSON shapes are not live-verified in this
 * environment (the sandbox's network policy blocks `.gov.gr`, see
 * CLAUDE.md). Fields below are the ones consistently evidenced across the
 * official client samples and blog docs; schemas use `.passthrough()` so
 * unexpected extra fields never cause a parse failure, and the
 * well-evidenced fields are optional rather than required so a shape drift
 * degrades to "missing field" instead of a hard error.
 */
export const DiavgeiaOrganizationRef = z
  .object({
    uid: z.string().optional(),
    label: z.string().optional(),
  })
  .loose();

export const DiavgeiaDecisionSchema = z
  .object({
    ada: z.string().optional(),
    subject: z.string().optional(),
    issueDate: z.union([z.string(), z.number()]).optional(),
    submissionTimestamp: z.union([z.string(), z.number()]).optional(),
    protocolNumber: z.string().optional(),
    organizationId: z.union([z.string(), z.number()]).optional(),
    organization: DiavgeiaOrganizationRef.optional(),
    decisionTypeUid: z.string().optional(),
    unitIds: z.array(z.union([z.string(), z.number()])).optional(),
    documentUrl: z.string().optional(),
    url: z.string().optional(),
    status: z.string().optional(),
  })
  .loose();

export type DiavgeiaDecision = z.infer<typeof DiavgeiaDecisionSchema>;

export const DiavgeiaSearchResponseSchema = z
  .object({
    decisions: z.array(DiavgeiaDecisionSchema).default([]),
    total: z.number().optional(),
    page: z.number().optional(),
    size: z.number().optional(),
  })
  .loose();

export type DiavgeiaSearchResponse = z.infer<typeof DiavgeiaSearchResponseSchema>;

export const DiavgeiaOrganizationSchema = z
  .object({
    uid: z.string().optional(),
    label: z.string().optional(),
    category: z.string().optional(),
    status: z.string().optional(),
  })
  .loose();

export type DiavgeiaOrganization = z.infer<typeof DiavgeiaOrganizationSchema>;
