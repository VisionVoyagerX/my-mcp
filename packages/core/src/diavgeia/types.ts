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

export type DiavgeiaSearchResponse = z.infer<
  typeof DiavgeiaSearchResponseSchema
>;

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
  /** Non-nullable on GET /organizations/{uid}/, but observed null for some entries in the bulk GET /organizations list (verified live 2026-07-23). */
  odeManagerEmail: z.string().nullable(),
  website: z.string().nullable(),
  supervisorId: z.string().nullable(),
  supervisorLabel: z.string().nullable(),
  organizationDomains: z.array(z.string()).nullable(),
});

export type DiavgeiaOrganization = z.infer<typeof DiavgeiaOrganizationSchema>;

/**
 * GET /organizations — verified live 2026-07-23. Same shape per-item as
 * GET /organizations/{uid}/ (DiavgeiaOrganizationSchema above), but this
 * endpoint ignores page/size entirely and always returns its full match set
 * (confirmed: unfiltered call returns all 5413 organizations regardless of
 * a `size` param) — pagination for this tool is applied client-side in
 * DiavgeiaClient.searchOrganizations, not by the API.
 */
export const DiavgeiaOrganizationsResponseSchema = z.object({
  organizations: z.array(DiavgeiaOrganizationSchema),
});

/**
 * GET /types — verified live 2026-07-23. Flat, unpaginated list (43 total).
 * Entries with allowedInDecisions: false are category headers (parent: null)
 * used only to group the 35 leaf types that are valid decisionTypeUid values.
 */
export const DiavgeiaDecisionTypeSchema = z.object({
  uid: z.string(),
  label: z.string(),
  parent: z.string().nullable(),
  allowedInDecisions: z.boolean(),
});

export type DiavgeiaDecisionType = z.infer<typeof DiavgeiaDecisionTypeSchema>;

export const DiavgeiaDecisionTypesResponseSchema = z.object({
  decisionTypes: z.array(DiavgeiaDecisionTypeSchema),
});

/**
 * GET /decisions/{ada}/versionlog — verified live 2026-07-23. History of
 * every published version of a decision (initial publication + any
 * corrections). `creator` is an internal user identifier, not a signer UID.
 */
export const DiavgeiaDecisionVersionLogEntrySchema = z.object({
  versionId: z.string(),
  creator: z.string(),
  versionTimestamp: z.number(),
  description: z.string().nullable(),
  status: z.string(),
  correctedVersionId: z.string().nullable(),
});

export const DiavgeiaDecisionVersionLogSchema = z.object({
  versions: z.array(DiavgeiaDecisionVersionLogEntrySchema),
  ada: z.string(),
  organizationId: z.string(),
});

export type DiavgeiaDecisionVersionLog = z.infer<
  typeof DiavgeiaDecisionVersionLogSchema
>;

/**
 * GET /search/terms, /search/terms/common, /types/{typeUid}/terms — verified
 * live 2026-07-23. All three return the same {term, label} shape; `term` is
 * the field name usable in /search's keyword params or extraFieldValues search.
 */
export const DiavgeiaSearchTermSchema = z.object({
  term: z.string(),
  label: z.string(),
});

export const DiavgeiaSearchTermsResponseSchema = z.object({
  terms: z.array(DiavgeiaSearchTermSchema),
});

export type DiavgeiaSearchTerm = z.infer<typeof DiavgeiaSearchTermSchema>;

/**
 * GET /units/{id}/ and GET /organizations/{uid}/units — verified live
 * 2026-07-23. Same shape standalone, listed under an org, or embedded in
 * GET /organizations/{uid}/details.
 */
export const DiavgeiaUnitSchema = z.object({
  uid: z.string(),
  label: z.string(),
  abbreviation: z.string().nullable(),
  category: z.string(),
  /** Observed null for some units in GET /organizations/{uid}/details (verified live 2026-07-23), not just []. */
  unitDomains: z.array(z.string()).nullable(),
  active: z.boolean(),
  activeFrom: z.number().nullable(),
  activeUntil: z.number().nullable(),
  parentId: z.string(),
});

export type DiavgeiaUnit = z.infer<typeof DiavgeiaUnitSchema>;

export const DiavgeiaUnitsResponseSchema = z.object({
  units: z.array(DiavgeiaUnitSchema),
});

/**
 * GET /signers/{id}/ and GET /organizations/{uid}/signers — verified live
 * 2026-07-23. `units` here lists each unit/position pairing the signer holds
 * (a signer can hold positions in more than one unit).
 */
export const DiavgeiaSignerUnitSchema = z.object({
  uid: z.string(),
  positionId: z.string(),
  positionLabel: z.string(),
  activationDate: z.number().nullable(),
  deactivationDate: z.number().nullable(),
});

export const DiavgeiaSignerSchema = z.object({
  uid: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  active: z.boolean(),
  activeFrom: z.number().nullable(),
  activeUntil: z.number().nullable(),
  organizationId: z.string(),
  hasOrganizationSignRights: z.boolean(),
  units: z.array(DiavgeiaSignerUnitSchema),
});

export type DiavgeiaSigner = z.infer<typeof DiavgeiaSignerSchema>;

export const DiavgeiaSignersResponseSchema = z.object({
  signers: z.array(DiavgeiaSignerSchema),
});

/**
 * GET /positions and GET /organizations/{uid}/positions — verified live
 * 2026-07-23. `/positions` (no uid) is a global, unfiltered dictionary of
 * ~25,000 position labels used across every organization; the org-scoped
 * variant returns only the positions actually held within that organization.
 */
export const DiavgeiaPositionSchema = z.object({
  uid: z.string(),
  label: z.string(),
});

export type DiavgeiaPosition = z.infer<typeof DiavgeiaPositionSchema>;

export const DiavgeiaPositionsResponseSchema = z.object({
  positions: z.array(DiavgeiaPositionSchema),
});

/**
 * GET /organizations/{uid}/details — verified live 2026-07-23. A superset of
 * GET /organizations/{uid}/ that embeds the org's units, signers, positions,
 * and any organizations it supervises (each a full DiavgeiaOrganization) in
 * one call. Note: embedded `units` reflects descendants=all, unlike the
 * standalone /organizations/{uid}/units endpoint which defaults to
 * descendants=children (verified: 46 vs 27 units for the same org).
 */
export const DiavgeiaOrganizationDetailsSchema =
  DiavgeiaOrganizationSchema.extend({
    units: z.array(DiavgeiaUnitSchema),
    signers: z.array(DiavgeiaSignerSchema),
    positions: z.array(DiavgeiaPositionSchema),
    supervisedOrganizations: z.array(DiavgeiaOrganizationSchema),
  });

export type DiavgeiaOrganizationDetails = z.infer<
  typeof DiavgeiaOrganizationDetailsSchema
>;

/**
 * GET /dictionaries and GET /dictionaries/{name} — verified live 2026-07-23.
 * Reference vocabularies (e.g. ORG_CATEGORY, CPV, CURRENCY) used as the
 * accepted-value sets for various decision/organization fields.
 */
export const DiavgeiaDictionaryListSchema = z.object({
  dictionaries: z.array(z.object({ uid: z.string(), label: z.string() })),
});

export const DiavgeiaDictionaryItemSchema = z.object({
  uid: z.string(),
  label: z.string(),
  parent: z.string().nullable(),
});

export const DiavgeiaDictionarySchema = z.object({
  name: z.string(),
  items: z.array(DiavgeiaDictionaryItemSchema),
});

export type DiavgeiaDictionary = z.infer<typeof DiavgeiaDictionarySchema>;

/**
 * GET /types/{typeUid}/details — verified live 2026-07-23. Adds the
 * per-decision-type `extraFieldValues` schema on top of the base decision
 * type (uid/label/parent/allowedInDecisions) — required to know what a
 * decision of this type is allowed/required to carry, and to resolve a
 * `searchTerm` back to the extra field it filters. `nestedFields` recurses
 * for compound/object-typed fields (e.g. a "person" field with afm/name).
 */
export interface DiavgeiaDecisionTypeExtraField {
  uid: string;
  /** Observed null for at least one field (documentType) on GET /types/{typeUid}/details, verified live 2026-07-23. */
  label: string | null;
  help: string | null;
  type: string;
  validation: string | null;
  required: boolean;
  multiple: boolean;
  maxLength: number;
  dictionary: string | null;
  searchTerm: string | null;
  relAdaDecisionTypes: string[] | null;
  relAdaConstrainedInOrganization: boolean | null;
  fixedValueList: string[] | null;
  nestedFields: DiavgeiaDecisionTypeExtraField[];
}

export const DiavgeiaDecisionTypeExtraFieldSchema: z.ZodType<DiavgeiaDecisionTypeExtraField> =
  z.lazy(() =>
    z.object({
      uid: z.string(),
      label: z.string().nullable(),
      help: z.string().nullable(),
      type: z.string(),
      validation: z.string().nullable(),
      required: z.boolean(),
      multiple: z.boolean(),
      maxLength: z.number(),
      dictionary: z.string().nullable(),
      searchTerm: z.string().nullable(),
      relAdaDecisionTypes: z.array(z.string()).nullable(),
      relAdaConstrainedInOrganization: z.boolean().nullable(),
      fixedValueList: z.array(z.string()).nullable(),
      nestedFields: z.array(DiavgeiaDecisionTypeExtraFieldSchema),
    }),
  );

export const DiavgeiaDecisionTypeDetailsSchema =
  DiavgeiaDecisionTypeSchema.extend({
    extraFields: z.array(DiavgeiaDecisionTypeExtraFieldSchema),
  });

export type DiavgeiaDecisionTypeDetails = z.infer<
  typeof DiavgeiaDecisionTypeDetailsSchema
>;
