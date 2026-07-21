import { z } from "zod";

/**
 * Field names, required/nullable-ness verified live 2026-07-19 against
 * https://diavgeia.gov.gr/luminapi/opendata (search/advanced, decisions/{ada},
 * organizations/{uid}) — not just docs/samples. Nullable fields below are
 * ones actually observed as `null` in live responses; everything else was
 * observed present across every sampled decision/organization.
 *
 * Note the naming split: the *search query* field for organization/decision-type
 * filters is `organizationUid`/`decisionTypeUid` (see client.ts), but the
 * *decision object* returned by the API uses `organizationId`/`decisionTypeId`.
 * That's a real inconsistency in Diavgeia's own API, not a bug here.
 */

export const DiavgeiaDecisionSchema = z.object({
  ada: z.string(),
  subject: z.string(),
  issueDate: z.number(),
  submissionTimestamp: z.number(),
  publishTimestamp: z.number(),
  protocolNumber: z.string(),
  organizationId: z.string(),
  decisionTypeId: z.string(),
  signerIds: z.array(z.string()),
  unitIds: z.array(z.string()),
  thematicCategoryIds: z.array(z.string()),
  /** Shape varies per decision type (hundreds of them) — intentionally untyped. */
  extraFieldValues: z.record(z.string(), z.unknown()),
  privateData: z.boolean(),
  versionId: z.string(),
  status: z.string(),
  url: z.string(),
  documentUrl: z.string(),
  documentChecksum: z.string().nullable(),
  correctedVersionId: z.string().nullable(),
  warnings: z.array(z.unknown()).nullable(),
  attachments: z.array(z.unknown()),
});

export type DiavgeiaDecision = z.infer<typeof DiavgeiaDecisionSchema>;

export const DiavgeiaSearchResponseSchema = z
  .object({
    decisions: z.array(DiavgeiaDecisionSchema).default([]),
    info: z.object({
      query: z.string(),
      page: z.number(),
      size: z.number(),
      actualSize: z.number(),
      total: z.number(),
      order: z.string(),
    }),
  })
  .transform(({ decisions, info }) => ({
    decisions,
    total: info.total,
    page: info.page,
    size: info.size,
  }));

export type DiavgeiaSearchResponse = z.infer<typeof DiavgeiaSearchResponseSchema>;

export const DiavgeiaOrganizationSchema = z.object({
  uid: z.string(),
  label: z.string(),
  abbreviation: z.string().nullable(),
  latinName: z.string(),
  status: z.string(),
  category: z.string(),
  vatNumber: z.string(),
  fekNumber: z.string(),
  fekIssue: z.string(),
  fekYear: z.string(),
  odeManagerEmail: z.string(),
  website: z.string(),
  supervisorId: z.string().nullable(),
  supervisorLabel: z.string().nullable(),
  organizationDomains: z.array(z.string()).nullable(),
});

export type DiavgeiaOrganization = z.infer<typeof DiavgeiaOrganizationSchema>;
