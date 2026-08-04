import { z } from "zod";

/**
 * Confirmed 2026-07-25 against the official Swagger 2.0 spec, fetched live
 * from `https://opendata-api.businessportal.gr/api-docs` (the docs page at
 * `/opendata/docs/` is a JS-rendered Swagger UI shell; the actual spec URL
 * is only discoverable via the `Swagger-API-Docs-URL` response header on a
 * HEAD request to that page). Field names below are taken directly from
 * that spec's `definitions`. `.loose()` + `.nullish()` throughout since the
 * spec doesn't mark most fields `required`.
 *
 * Exercised end-to-end against real responses on 2026-08-04 with a real
 * `GEMI_API_KEY` (metadata endpoints, `/companies` search, `/companies/{id}`,
 * `/companies/{id}/documents`). The spec's claimed types are wrong in a few
 * places it doesn't cover with a live check — search inline comments below
 * for "2026-08-04" for the specific fields that diverge and why.
 */

/** The small `{ id, descr }` shape used for nested refs inside `Company` (municipality, prefecture, legalType, gemiOffice, assemblySubjects, status). */
const GemiRefSchema = z
  .object({
    id: z.number().nullish(),
    descr: z.string().nullish(),
  })
  .loose();

const GemiActivityRefSchema = z
  .object({
    id: z.string().nullish(),
    descr: z.string().nullish(),
    kadVersion: z.string().nullish(),
  })
  .loose();

export const GemiCompanyActivitySchema = z
  .object({
    activity: GemiActivityRefSchema.nullish(),
    type: z.string().nullish(),
    dtFrom: z.string().nullish(),
    dtTo: z.string().nullish(),
  })
  .loose();

export const GemiCompanyPersonSchema = z
  .object({
    personName: z.string().nullish(),
    businessName: z.string().nullish(),
    role: z.string().nullish(),
    dtFrom: z.string().nullish(),
    dtTo: z.string().nullish(),
    isRepresentativeAlone: z.boolean().nullish(),
    isRepresentativeInCommon: z.boolean().nullish(),
    percentage: z.string().nullish(),
    category: z.string().nullish(),
  })
  .loose();

const GemiCapitalSchema = z
  .object({
    capitalStock: z.number().nullish(),
    currency: z.string().nullish(),
    ecsokefalaiikes: z.number().nullish(),
    eggiitikes: z.number().nullish(),
  })
  .loose();

const GemiStockSchema = z
  .object({
    stockTypeId: z.number().nullish(),
    amount: z.number().nullish(),
    nominalPrice: z.number().nullish(),
    stockType: z.string().nullish(),
  })
  .loose();

export const GemiCompanySchema = z
  .object({
    // Spec says integer; every live response (search + single-company GET,
    // verified 2026-08-04 with a real key) actually returns this as a
    // string (e.g. "8515901000"). Accept both rather than trusting the spec.
    arGemi: z.union([z.string(), z.number()]).nullish(),
    afm: z.string().nullish(),
    coNameEl: z.string().nullish(),
    coNamesEn: z.array(z.string()).default([]),
    coTitlesEl: z.array(z.string()).default([]),
    coTitlesEn: z.array(z.string()).default([]),
    municipality: GemiRefSchema.nullish(),
    prefecture: GemiRefSchema.nullish(),
    city: z.string().nullish(),
    street: z.string().nullish(),
    streetNumber: z.string().nullish(),
    zipCode: z.string().nullish(),
    poBox: z.string().nullish(),
    url: z.string().nullish(),
    email: z.string().nullish(),
    isBranch: z.boolean().nullish(),
    objective: z.string().nullish(),
    legalType: GemiRefSchema.nullish(),
    gemiOffice: GemiRefSchema.nullish(),
    assemblySubjects: GemiRefSchema.nullish(),
    incorporationDate: z.string().nullish(),
    lastStatusChange: z.string().nullish(),
    status: GemiRefSchema.nullish(),
    autoRegistered: z.boolean().nullish(),
    activities: z.array(GemiCompanyActivitySchema).default([]),
    persons: z.array(GemiCompanyPersonSchema).default([]),
    capital: z.array(GemiCapitalSchema).default([]),
    stocks: z.array(GemiStockSchema).default([]),
    branch: z.array(z.number()).default([]),
  })
  .loose();

export type GemiCompany = z.infer<typeof GemiCompanySchema>;

/** Response envelope for `GET /companies`: `{ searchMetadata, searchResults }`, not a bare array. */
export const GemiSearchResponseSchema = z
  .object({
    searchMetadata: z
      .object({
        totalCount: z.number().nullish(),
        resultsOffset: z.number().nullish(),
        resultsSize: z.union([z.string(), z.number()]).nullish(),
      })
      .loose()
      .nullish(),
    searchResults: z.array(GemiCompanySchema).default([]),
  })
  .loose();

export type GemiSearchResponse = z.infer<typeof GemiSearchResponseSchema>;

export const GemiCompanyDocumentDecisionSchema = z
  .object({
    dateAssemblyDecided: z.string().nullish(),
    assembly: z.string().nullish(),
    summary: z.string().nullish(),
    kak: z.string().nullish(),
    decisionSubject: z.string().nullish(),
    decisionSubjectID: z.string().nullish(),
    dateAnnounced: z.string().nullish(),
    assemblyDecisionUrl: z.string().nullish(),
    dateRegistrated: z.string().nullish(),
    applicationStatusId: z.string().nullish(),
    applicationStatusDescription: z.string().nullish(),
    referenceKak: z.string().nullish(),
  })
  .loose();

export const GemiCompanyDocumentPublicationSchema = z
  .object({
    url: z.string().nullish(),
    kad: z.string().nullish(),
  })
  .loose();

export const GemiCompanyDocumentSetSchema = z
  .object({
    decision: z.array(GemiCompanyDocumentDecisionSchema).default([]),
    publication: z.array(GemiCompanyDocumentPublicationSchema).default([]),
  })
  .loose();

export type GemiCompanyDocumentSet = z.infer<
  typeof GemiCompanyDocumentSetSchema
>;

/** `GET /metadata/activities` — ΚΑΔ (business activity) reference codes. */
export const GemiActivitySchema = z
  .object({
    id: z.string().nullish(),
    descr: z.string().nullish(),
    descrEn: z.string().nullish(),
    lastUpdated: z.string().nullish(),
    kadVersion: z.string().nullish(),
  })
  .loose();
export type GemiActivity = z.infer<typeof GemiActivitySchema>;

/** `GET /metadata/prefectures` — νομοί. */
export const GemiPrefectureSchema = z
  .object({
    id: z.string().nullish(),
    descr: z.string().nullish(),
    descrEn: z.string().nullish(),
    lastUpdated: z.string().nullish(),
  })
  .loose();
export type GemiPrefecture = z.infer<typeof GemiPrefectureSchema>;

/** `GET /metadata/municipalities` — δήμοι. */
export const GemiMunicipalitySchema = z
  .object({
    id: z.string().nullish(),
    prefectureId: z.string().nullish(),
    descr: z.string().nullish(),
    descrEn: z.string().nullish(),
    lastUpdated: z.string().nullish(),
  })
  .loose();
export type GemiMunicipality = z.infer<typeof GemiMunicipalitySchema>;

/**
 * `GET /metadata/companyStatuses`. Spec says `id` is an integer; live
 * responses (verified 2026-08-04) return it as a string, unlike the
 * `status.id` on a nested `Company.status` ref, which really is a number.
 */
export const GemiCompanyStatusSchema = z
  .object({
    id: z.string().nullish(),
    descr: z.string().nullish(),
    descrEn: z.string().nullish(),
    isActive: z.boolean().nullish(),
    lastUpdated: z.string().nullish(),
  })
  .loose();
export type GemiCompanyStatus = z.infer<typeof GemiCompanyStatusSchema>;

/**
 * `GET /metadata/legalTypes` — legal form codes (ΑΕ, ΕΠΕ, ΙΚΕ, ...). Spec
 * says `id` is an integer; live responses (verified 2026-08-04) return it
 * as a string, unlike the `legalType.id` on a nested `Company.legalType`
 * ref, which really is a number.
 */
export const GemiLegalTypeSchema = z
  .object({
    id: z.string().nullish(),
    descr: z.string().nullish(),
    descrEn: z.string().nullish(),
    lastUpdated: z.string().nullish(),
  })
  .loose();
export type GemiLegalType = z.infer<typeof GemiLegalTypeSchema>;

/**
 * `GET /metadata/gemiOffices` — local ΓΕΜΗ registry offices. Spec says
 * `id` is an integer; live responses (verified 2026-08-04) return it as a
 * string, unlike the `gemiOffice.id` on a nested `Company.gemiOffice` ref,
 * which really is a number.
 */
export const GemiOfficeSchema = z
  .object({
    id: z.string().nullish(),
    descr: z.string().nullish(),
    descrEn: z.string().nullish(),
    lastUpdated: z.string().nullish(),
    address: z.string().nullish(),
    city: z.string().nullish(),
    zipCode: z.string().nullish(),
    phone: z.string().nullish(),
    fax: z.string().nullish(),
    url: z.string().nullish(),
  })
  .loose();
export type GemiOffice = z.infer<typeof GemiOfficeSchema>;

/** `GET /metadata/assemblySubjects` — decision/assembly subject codes. */
export const GemiAssemblySubjectSchema = z
  .object({
    id: z.string().nullish(),
    descr: z.string().nullish(),
    descrEn: z.string().nullish(),
    lastUpdated: z.string().nullish(),
  })
  .loose();
export type GemiAssemblySubject = z.infer<typeof GemiAssemblySubjectSchema>;
