import { z } from "zod";

export interface GeodataLayer {
  name: string;
  title?: string;
}

/**
 * GeoServer WFS `outputFormat=application/json` returns a standard GeoJSON
 * FeatureCollection. That output format itself is a stable OGC/GeoServer
 * convention, but geodata.gov.gr's exact base URL and layer catalog are
 * **not confirmed live** — RESEARCH.md rates this Low-Medium confidence and
 * this sandbox cannot reach `.gov.gr` to verify. Override GEODATA_BASE_URL
 * once the real endpoint is confirmed from an unrestricted network.
 */
export const GeoJsonFeatureCollectionSchema = z
  .object({
    type: z.literal("FeatureCollection").optional(),
    totalFeatures: z.union([z.number(), z.string()]).optional(),
    features: z
      .array(
        z
          .object({
            type: z.string().optional(),
            id: z.union([z.string(), z.number()]).optional(),
            geometry: z.record(z.string(), z.unknown()).nullable().optional(),
            properties: z.record(z.string(), z.unknown()).optional(),
          })
          .loose(),
      )
      .default([]),
  })
  .loose();

export type GeoJsonFeatureCollection = z.infer<typeof GeoJsonFeatureCollectionSchema>;
