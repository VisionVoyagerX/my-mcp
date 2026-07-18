import { buildQuery, fetchJson, fetchText } from "../http.js";
import {
  GeoJsonFeatureCollectionSchema,
  type GeoJsonFeatureCollection,
  type GeodataLayer,
} from "./types.js";

/**
 * Path confirmed live 2026-07-18 via indexed dataset resource URLs (e.g.
 * geodata.gov.gr/en/dataset/periphereies-elladas/resource/... links to a
 * geoserver/ows WMS GetCapabilities call). Scheme is plain HTTP, not HTTPS —
 * an earlier `https://` default produced a connection-level "fetch failed"
 * rather than an HTTP error, consistent with this host not serving TLS.
 * Override with GEODATA_BASE_URL if that changes.
 */
const DEFAULT_BASE_URL = "http://geodata.gov.gr/geoserver/ows";

const FEATURE_TYPE_BLOCK = /<(?:wfs:)?FeatureType>([\s\S]*?)<\/(?:wfs:)?FeatureType>/g;
const NAME_TAG = /<(?:wfs:)?Name>([^<]+)<\/(?:wfs:)?Name>/;
const TITLE_TAG = /<(?:wfs:)?Title>([^<]+)<\/(?:wfs:)?Title>/;

export class GeodataClient {
  private readonly baseUrl: string;

  constructor(options: { baseUrl?: string } = {}) {
    this.baseUrl = options.baseUrl ?? process.env.GEODATA_BASE_URL ?? DEFAULT_BASE_URL;
  }

  /**
   * List available WFS layers via GetCapabilities. Parses the layer
   * name/title out of the capabilities XML with a lightweight regex rather
   * than a full XML parser, since we only need those two fields.
   */
  async listLayers(): Promise<GeodataLayer[]> {
    const qs = buildQuery({ service: "WFS", version: "2.0.0", request: "GetCapabilities" });
    const xml = await fetchText(`${this.baseUrl}${qs}`);
    const layers: GeodataLayer[] = [];
    for (const match of xml.matchAll(FEATURE_TYPE_BLOCK)) {
      const block = match[1] ?? "";
      const name = NAME_TAG.exec(block)?.[1];
      if (!name) continue;
      const title = TITLE_TAG.exec(block)?.[1];
      layers.push({ name, title });
    }
    return layers;
  }

  /** Fetch features for a WFS layer (by its qualified type name) as GeoJSON. */
  async getFeatures(
    typeName: string,
    options: { maxFeatures?: number; bbox?: string } = {},
  ): Promise<GeoJsonFeatureCollection> {
    const qs = buildQuery({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: typeName,
      outputFormat: "application/json",
      count: options.maxFeatures ?? 50,
      bbox: options.bbox,
    });
    const raw = await fetchJson<unknown>(`${this.baseUrl}${qs}`);
    return GeoJsonFeatureCollectionSchema.parse(raw);
  }
}
