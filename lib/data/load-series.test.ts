import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Series } from "@/lib/chart/types";
import {
  loadSeries,
  parseSeries,
  resetSeriesCacheForTests,
  seriesUrl,
} from "./load-series";

function valid(id: string): Series<string> {
  return {
    id,
    tf: "1d",
    t: [1000, 2000],
    o: [1, 2],
    h: [2, 3],
    l: [0.5, 1.5],
    c: [1.5, 2.5],
    v: [10, 20],
  };
}

describe("parseSeries", () => {
  it("accepts a well-formed payload", () => {
    expect(parseSeries(valid("SPY-1d"), "SPY-1d").t).toHaveLength(2);
  });

  it("rejects an id that does not match what was requested", () => {
    // Catches a mis-named file, which would otherwise render the wrong market
    // under a level's brief.
    expect(() => parseSeries(valid("AAPL-1d"), "SPY-1d")).toThrow(/declares id/);
  });

  it("rejects mismatched column lengths", () => {
    const broken = { ...valid("SPY-1d"), v: [10] };
    expect(() => parseSeries(broken, "SPY-1d")).toThrow(/column v has 1/);
  });

  it("rejects a missing column", () => {
    const { h: _h, ...broken } = valid("SPY-1d");
    expect(() => parseSeries(broken, "SPY-1d")).toThrow(/column h is missing/);
  });

  it("rejects an empty series", () => {
    const empty = { ...valid("SPY-1d"), t: [], o: [], h: [], l: [], c: [], v: [] };
    expect(() => parseSeries(empty, "SPY-1d")).toThrow(/empty/);
  });

  it("rejects non-objects", () => {
    for (const bad of [null, undefined, 42, "x", []]) {
      expect(() => parseSeries(bad, "SPY-1d")).toThrow();
    }
  });
});

describe("loadSeries", () => {
  beforeEach(() => resetSeriesCacheForTests());
  afterEach(() => vi.unstubAllGlobals());

  it("fetches from the public data path", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(valid("SPY-1d"))));
    vi.stubGlobal("fetch", fetchMock);

    await loadSeries("SPY-1d");
    expect(fetchMock).toHaveBeenCalledWith("/data/series/SPY-1d.json");
  });

  it("caches so a second call does not refetch", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(valid("SPY-1d"))));
    vi.stubGlobal("fetch", fetchMock);

    await loadSeries("SPY-1d");
    await loadSeries("SPY-1d");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent requests for the same series", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(valid("SPY-1d"))));
    vi.stubGlobal("fetch", fetchMock);

    // Two level panes mounting together must not each start a request.
    await Promise.all([loadSeries("SPY-1d"), loadSeries("SPY-1d"), loadSeries("SPY-1d")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 404 }));
    await expect(loadSeries("SPY-1d")).rejects.toThrow(/HTTP 404/);
  });

  it("does not cache a failed load", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls += 1;
      return calls === 1
        ? new Response("nope", { status: 500 })
        : new Response(JSON.stringify(valid("SPY-1d")));
    });

    await expect(loadSeries("SPY-1d")).rejects.toThrow();
    await expect(loadSeries("SPY-1d")).resolves.toBeDefined();
    expect(calls).toBe(2);
  });
});

describe("seriesUrl", () => {
  it("points at the committed public path", () => {
    expect(seriesUrl("BTCUSDT-4h")).toBe("/data/series/BTCUSDT-4h.json");
  });
});
