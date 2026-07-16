export { GovApiError, fetchJson, fetchText, buildQuery } from "./http.js";
export type { FetchJsonOptions } from "./http.js";

export { toolTextResult, toolErrorResult } from "./tool-result.js";
export type { ToolTextResult } from "./tool-result.js";

export { DiavgeiaClient } from "./diavgeia/client.js";
export type { DiavgeiaSearchParams } from "./diavgeia/client.js";
export type {
  DiavgeiaDecision,
  DiavgeiaOrganization,
  DiavgeiaSearchResponse,
} from "./diavgeia/types.js";

export { CkanClient } from "./ckan/client.js";
export type { CkanSearchParams } from "./ckan/client.js";
export type { CkanDataset, CkanSearchResult } from "./ckan/types.js";

export { GeodataClient } from "./geodata/client.js";
export type { GeoJsonFeatureCollection, GeodataLayer } from "./geodata/types.js";

export { GemiClient } from "./gemi/client.js";
export type { GemiCompany } from "./gemi/types.js";

export { MyDataClient } from "./mydata/client.js";
export type { MyDataCredentials, MyDataRequestDocsParams } from "./mydata/client.js";

export { ErganiClient } from "./ergani/client.js";
export type { ErganiCredentials, ErganiService } from "./ergani/client.js";
