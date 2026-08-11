import { z } from "zod";

/**
 * ΚΗΜΔΗΣ's Open Data API (live-verified 2026-08-08 via direct unauthenticated
 * HTTP requests from this environment — see RESEARCH.md) represents most
 * reference fields (organization, contract type, procedure type, NUTS code,
 * etc.) as a `{key, value}` pair: a numeric/short code plus its human-readable
 * label. Reused across every record type below.
 */
export const KimdisCodeSchema = z
  .object({
    key: z.string().nullish(),
    value: z.string().nullish(),
  })
  .loose();

export type KimdisCode = z.infer<typeof KimdisCodeSchema>;

/**
 * Spring-style Pageable envelope wrapping every /request, /notice, /auction,
 * /contract, /payment search response (confirmed live: totalElements,
 * totalPages, number/size, content[]). `.loose()` on both this and every
 * record schema below: live responses run 30-50+ fields per record, most
 * unused by this client's tools — only the fields the tools actually surface
 * are declared, everything else passes through unvalidated rather than being
 * silently dropped or rejected.
 */
export const KimdisPageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({
      content: z.array(item).default([]),
      totalElements: z.number().default(0),
      totalPages: z.number().default(0),
      number: z.number().default(0),
      size: z.number().default(0),
      first: z.boolean().optional(),
      last: z.boolean().optional(),
    })
    .loose();

export type KimdisPage<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first?: boolean;
  last?: boolean;
};

/** Stage 1: Αίτημα — an authority's internal pre-tender procurement request, before any public notice. */
export const KimdisRequestSchema = z
  .object({
    title: z.string().nullish(),
    referenceNumber: z.string(),
    signedDate: z.string().nullish(),
    submissionDate: z.string().nullish(),
    protocolNumber: z.string().nullish(),
    organization: KimdisCodeSchema.nullish(),
    organizationVatNumber: z.string().nullish(),
    totalCostWithVAT: z.number().nullish(),
    totalCostWithoutVAT: z.number().nullish(),
    approved: z.boolean().nullish(),
    cancelled: z.boolean().nullish(),
  })
  .loose();

export type KimdisRequest = z.infer<typeof KimdisRequestSchema>;

/** Stage 2: Πρόσκληση/Προκήρυξη/Διακήρυξη — the public tender announcement (what appears live in ΕΣΗΔΗΣ for bidders). */
export const KimdisNoticeSchema = z
  .object({
    title: z.string().nullish(),
    referenceNumber: z.string(),
    signedDate: z.string().nullish(),
    submissionDate: z.string().nullish(),
    finalSubmissionDate: z.string().nullish(),
    organization: KimdisCodeSchema.nullish(),
    organizationVatNumber: z.string().nullish(),
    typeOfProcedure: KimdisCodeSchema.nullish(),
    contractType: KimdisCodeSchema.nullish(),
    cancelled: z.boolean().nullish(),
  })
  .loose();

export type KimdisNotice = z.infer<typeof KimdisNoticeSchema>;

/**
 * Stage 3: Ανάθεση — the award decision (who won). The underlying endpoint
 * is named `/auction`, a literal-translation artifact in the official docs,
 * not a bidding auction — this client exposes it as "award" throughout.
 */
export const KimdisAwardSchema = z
  .object({
    title: z.string().nullish(),
    referenceNumber: z.string(),
    signedDate: z.string().nullish(),
    submissionDate: z.string().nullish(),
    organization: KimdisCodeSchema.nullish(),
    organizationVatNumber: z.string().nullish(),
    procedureType: KimdisCodeSchema.nullish(),
    contractType: KimdisCodeSchema.nullish(),
    budget: z.number().nullish(),
    totalCostWithVAT: z.number().nullish(),
    totalCostWithoutVAT: z.number().nullish(),
    cancelled: z.boolean().nullish(),
  })
  .loose();

export type KimdisAward = z.infer<typeof KimdisAwardSchema>;

/** Stage 4: Σύμβαση — the signed contract formalizing an award. */
export const KimdisContractSchema = z
  .object({
    title: z.string().nullish(),
    referenceNumber: z.string(),
    contractSignedDate: z.string().nullish(),
    submissionDate: z.string().nullish(),
    startDate: z.string().nullish(),
    endDate: z.string().nullish(),
    contractNumber: z.string().nullish(),
    contractBudget: z.number().nullish(),
    organization: KimdisCodeSchema.nullish(),
    organizationVatNumber: z.string().nullish(),
    procedureType: KimdisCodeSchema.nullish(),
    contractType: KimdisCodeSchema.nullish(),
    cancelled: z.boolean().nullish(),
  })
  .loose();

export type KimdisContract = z.infer<typeof KimdisContractSchema>;

/** Stage 5: Πληρωμή — a payment order disbursed against a signed contract (a contract can have several). */
export const KimdisPaymentSchema = z
  .object({
    title: z.string().nullish(),
    referenceNumber: z.string(),
    signedDate: z.string().nullish(),
    submissionDate: z.string().nullish(),
    organization: KimdisCodeSchema.nullish(),
    organizationVatNumber: z.string().nullish(),
    contractType: KimdisCodeSchema.nullish(),
    totalCostWithVAT: z.number().nullish(),
    totalCostWithoutVAT: z.number().nullish(),
    credit: z.boolean().nullish(),
    cancelled: z.boolean().nullish(),
  })
  .loose();

export type KimdisPayment = z.infer<typeof KimdisPaymentSchema>;

/**
 * GET /adamChain/{ref} response (confirmed live 2026-08-08): every ΑΔΑΜ
 * linked to the given one across all five lifecycle stages.
 */
export const KimdisAdamChainSchema = z
  .object({
    requests: z.array(z.string()).default([]),
    approvedRequests: z.array(z.string()).default([]),
    notices: z.array(z.string()).default([]),
    auctions: z.array(z.string()).default([]),
    contracts: z.array(z.string()).default([]),
    payments: z.array(z.string()).default([]),
  })
  .loose();

export type KimdisAdamChain = z.infer<typeof KimdisAdamChainSchema>;

/**
 * GET /pde response shape, live-verified 2026-08-11 against real ΠΔΕ funding
 * reference numbers pulled from live /contract search results: a fixed
 * object of three ΑΔΑΜ-code arrays, keyed by lifecycle stage. No `requests`
 * or `auctions`/awards key appears in either verified response — ΠΔΕ linkage
 * apparently starts at the notice stage, not the pre-tender request stage.
 */
export const KimdisPdeResultSchema = z
  .object({
    notices: z.array(z.string()).default([]),
    contracts: z.array(z.string()).default([]),
    payments: z.array(z.string()).default([]),
  })
  .loose();

export type KimdisPdeResult = z.infer<typeof KimdisPdeResultSchema>;
