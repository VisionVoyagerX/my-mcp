import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeodataClient } from "./client.js";

function loadFixture(name: string): string {
  const path = fileURLToPath(
    new URL(`./__fixtures__/${name}`, import.meta.url),
  );
  return readFileSync(path, "utf-8");
}

describe("GeodataClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("parses layer names/titles out of a GetCapabilities response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(loadFixture("get_capabilities.xml"), { status: 200 }),
    );
    const client = new GeodataClient({
      baseUrl: "https://example.test/geoserver/ows",
    });

    const layers = await client.listLayers();

    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("request")).toBe("GetCapabilities");
    expect(layers).toEqual([
      {
        name: "gr:administrative_boundaries",
        title: "Administrative Boundaries",
      },
      { name: "gr:land_use", title: "Land Use" },
    ]);
  });

  it("fetches GeoJSON features for a layer", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(loadFixture("get_feature.json"), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new GeodataClient({
      baseUrl: "https://example.test/geoserver/ows",
    });

    const collection = await client.getFeatures(
      "gr:administrative_boundaries",
      {
        maxFeatures: 5,
      },
    );

    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("typeNames")).toBe(
      "gr:administrative_boundaries",
    );
    expect(calledUrl.searchParams.get("outputFormat")).toBe("application/json");
    expect(calledUrl.searchParams.get("count")).toBe("5");
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0]?.properties?.name).toBe("Athens");
  });
});
