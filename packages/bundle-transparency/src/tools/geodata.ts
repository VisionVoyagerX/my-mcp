import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GeodataClient, GovApiError } from "@my-mcp/core";

function errorContent(error: unknown, context: string) {
  const message =
    error instanceof GovApiError
      ? `${context}: ${error.message}${error.status ? ` (HTTP ${error.status})` : ""}`
      : `${context}: ${error instanceof Error ? error.message : String(error)}`;
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function registerGeodataTools(server: McpServer): void {
  const client = new GeodataClient();

  server.registerTool(
    "geodata_list_layers",
    {
      title: "List Geodata.gov.gr layers",
      description:
        "List available geospatial layers (maps, boundaries, land use) published on " +
        "Geodata.gov.gr via its WFS service. Use geodata_get_features afterwards with a " +
        "layer's name to fetch its actual geometry/attribute data as GeoJSON.",
      inputSchema: {},
    },
    async () => {
      try {
        const layers = await client.listLayers();
        if (layers.length === 0) {
          return { content: [{ type: "text", text: "No layers were returned." }] };
        }
        const lines = layers.map((l) => `- ${l.name}${l.title ? ` — ${l.title}` : ""}`);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return errorContent(error, "Failed to list Geodata.gov.gr layers");
      }
    },
  );

  server.registerTool(
    "geodata_get_features",
    {
      title: "Get Geodata.gov.gr features",
      description:
        "Fetch geospatial features for a Geodata.gov.gr layer as GeoJSON, given the layer " +
        "name returned by geodata_list_layers. Optionally restrict to a bounding box.",
      inputSchema: {
        typeName: z
          .string()
          .min(1)
          .describe("The layer's qualified name, e.g. \"gr:administrative_boundaries\"."),
        maxFeatures: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe("Maximum number of features to return (1-1000). Defaults to 50."),
        bbox: z
          .string()
          .optional()
          .describe("Bounding box filter as \"minX,minY,maxX,maxY\" in the layer's CRS."),
      },
    },
    async ({ typeName, maxFeatures, bbox }) => {
      try {
        const collection = await client.getFeatures(typeName, { maxFeatures, bbox });
        return {
          content: [
            {
              type: "text",
              text: `${collection.features.length} feature(s) for "${typeName}":\n${JSON.stringify(collection, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return errorContent(error, `Failed to fetch features for layer "${typeName}"`);
      }
    },
  );
}
