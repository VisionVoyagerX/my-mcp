export { GovApiError, fetchJson, fetchText, buildQuery } from "./http.js";
export type { FetchJsonOptions } from "./http.js";

export { toolTextResult, toolErrorResult } from "./tool-result.js";
export type { ToolTextResult } from "./tool-result.js";

export { DiavgeiaClient } from "./diavgeia/client.js";
export type {
  DiavgeiaOrganizationSearchParams,
  DiavgeiaOrganizationSearchResult,
  DiavgeiaSearchParams,
  DiavgeiaSimpleSearchParams,
} from "./diavgeia/client.js";
export type {
  DiavgeiaDecision,
  DiavgeiaDecisionType,
  DiavgeiaDecisionTypeDetails,
  DiavgeiaDecisionVersionLog,
  DiavgeiaDictionary,
  DiavgeiaOrganization,
  DiavgeiaOrganizationDetails,
  DiavgeiaPosition,
  DiavgeiaSearchResponse,
  DiavgeiaSearchTerm,
  DiavgeiaSigner,
  DiavgeiaUnit,
} from "./diavgeia/types.js";
export { registerDiavgeiaTools } from "./diavgeia/tools.js";
export type { RegisterDiavgeiaToolsOptions } from "./diavgeia/tools.js";

export { CkanClient } from "./ckan/client.js";
export type { CkanSearchParams } from "./ckan/client.js";
export type { CkanDataset, CkanSearchResult } from "./ckan/types.js";
export { registerCkanTools } from "./ckan/tools.js";
export type { RegisterCkanToolsOptions } from "./ckan/tools.js";

export { GemiClient } from "./gemi/client.js";
export type {
  GemiActivity,
  GemiAssemblySubject,
  GemiCompany,
  GemiCompanyDocumentSet,
  GemiCompanyStatus,
  GemiLegalType,
  GemiMunicipality,
  GemiOffice,
  GemiPrefecture,
  GemiSearchResponse,
} from "./gemi/types.js";
export { registerGemiTools } from "./gemi/tools.js";
export type { RegisterGemiToolsOptions } from "./gemi/tools.js";

export { MyDataClient } from "./mydata/client.js";
export type {
  MyDataCredentials,
  MyDataDocsQueryParams,
  MyDataIncomeExpenseQueryParams,
  MyDataVatE3QueryParams,
  MyDataCancelInvoiceParams,
} from "./mydata/client.js";
export {
  MyDataApiError,
  parseMyDataResponse,
  parseMyDataResponseOrThrow,
} from "./mydata/xml.js";
export type { MyDataResponse, MyDataResponseEntry } from "./mydata/xml.js";
export {
  MyDataPartySchema,
  MyDataInvoiceLineSchema,
  MyDataInvoiceSummarySchema,
  MyDataInvoiceInputSchema,
  MyDataIncomeClassificationDetailSchema,
  MyDataIncomeClassificationLineSchema,
  MyDataClassificationInputSchema,
  MyDataExpensesClassificationDetailSchema,
  MyDataExpensesClassificationLineSchema,
  MyDataExpensesClassificationInputSchema,
  MyDataPaymentMethodDetailSchema,
  MyDataPaymentMethodInputSchema,
} from "./mydata/types.js";
export type {
  MyDataParty,
  MyDataInvoiceLine,
  MyDataInvoiceSummary,
  MyDataInvoiceInput,
  MyDataIncomeClassificationDetail,
  MyDataIncomeClassificationLine,
  MyDataClassificationInput,
  MyDataExpensesClassificationDetail,
  MyDataExpensesClassificationLine,
  MyDataExpensesClassificationInput,
  MyDataPaymentMethodDetail,
  MyDataPaymentMethodInput,
} from "./mydata/types.js";
export { registerMyDataTools } from "./mydata/tools.js";
export type { RegisterMyDataToolsOptions } from "./mydata/tools.js";

export { ErganiClient } from "./ergani/client.js";
export type { ErganiCredentials, ErganiService } from "./ergani/client.js";
export { registerErganiTools } from "./ergani/tools.js";
export type { RegisterErganiToolsOptions } from "./ergani/tools.js";

export {
  encryptJson,
  decryptJson,
  importEncryptionKey,
} from "./credentials/crypto.js";
export type { CredentialStore } from "./credentials/store.js";
export { createCredentialHelpers } from "./credentials/helpers.js";
export type {
  CredentialHelpers,
  CreateCredentialHelpersOptions,
} from "./credentials/helpers.js";
