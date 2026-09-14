import type { GenomicRegion, TrackFetchContext, TrackResources } from "@weng-lab/genomebrowser";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reader = vi.hoisted(() => ({
  read: vi.fn(),
  createBamFile: vi.fn(),
}));

vi.mock("@weng-lab/genomic-reader", () => ({
  createBamFile: reader.createBamFile,
}));

import { bamModule, computeCoverageRuns, computeJunctions } from "../../src/bam";
import { fetchBam } from "../../src/bam/fetch";
import { filterJunctions, layoutJunctionArcs, sampleReads } from "../../src/bam/helpers";
import type { BamConfig, BamData } from "../../src/bam/types";

type Cigar = { operation: "M" | "I" | "D" | "N" | "S" | "H" | "P" | "=" | "X"; length: number }[];

function alignment(start: number, cigar: Cigar, overrides: Partial<BamData[number]> = {}) {
  const span = cigar
    .filter((segment) => "MDN=X".includes(segment.operation))
    .reduce((total, segment) => total + segment.length, 0);
  return {
    chromosome: "chr1",
    start,
    end: start + span,
    name: `read-${start}`,
    flag: 0,
    mappingQuality: 60,
    strand: "+" as const,
    cigar,
    sequence: "",
    ...overrides,
  };
}

function createResources(): TrackResources {
  const map = new Map<string, unknown>();
  return {
    get: <T>(key: string) => map.get(key) as T | undefined,
    set: (key, value) => void map.set(key, value),
    delete: (key) => void map.delete(key),
    clear: () => map.clear(),
  };
}

const region: GenomicRegion = { chromosome: "chr1", start: 0, end: 1000 };

function createContext(config: Partial<BamConfig> = {}, demandRegion = region) {
  return {
    track: {
      base: { id: "bam", display: "coverage" },
      type: "bam",
      config: bamModule.configSchema.parse({ url: "https://example.test/reads.bam", ...config }),
    },
    demand: {
      assembly: { id: "test", chromosomes: { chr1: 1000 } },
      region: demandRegion,
      width: 500,
    },
    resources: createResources(),
  } as unknown as TrackFetchContext<BamConfig>;
}

beforeEach(() => {
  reader.read.mockReset();
  reader.createBamFile.mockReset();
  reader.createBamFile.mockReturnValue({ read: reader.read, getHeader: vi.fn() });
});

describe("BAM module", () => {
  it("creates with documented defaults", () => {
    const track = bamModule.create({
      base: { id: "reads", title: "Reads" },
      config: { url: "https://example.test/reads.bam" },
    });
    expect(track.base).toMatchObject({ display: "coverage", height: 180, color: "#5b8bd0" });
    expect(track.config).toMatchObject({
      maxBases: 25000,
      minMappingQuality: 0,
      maxReads: 400,
      minJunctionReads: 1,
      coverageColor: "#3a6ea5",
      reverseStrandColor: "#d08b5b",
    });
    expect(track.config.maxJunctionSpan).toBeUndefined();
  });

  it("declares coverage, pileup and sashimi displays", () => {
    expect(bamModule.displays).toEqual(["coverage", "pileup", "sashimi"]);
  });

  it("rejects invalid configuration", () => {
    expect(() =>
      bamModule.create({ base: { id: "a", title: "A" }, config: { url: "" } }),
    ).toThrow();
    expect(() =>
      bamModule.create({
        base: { id: "a", title: "A" },
        config: { url: "https://example.test/reads.bam", minMappingQuality: -1 },
      }),
    ).toThrow();
  });
});

describe("BAM fetching", () => {
  it("refuses windows wider than maxBases without reading", async () => {
    const context = createContext({ maxBases: 100 }, { chromosome: "chr1", start: 0, end: 500 });
    expect(await fetchBam(context)).toEqual([]);
    expect(reader.createBamFile).not.toHaveBeenCalled();
  });

  it("filters by mapping quality and reuses one reader per url", async () => {
    reader.read.mockResolvedValue([
      alignment(10, [{ operation: "M", length: 10 }], { mappingQuality: 0 }),
      alignment(20, [{ operation: "M", length: 10 }], { mappingQuality: 30 }),
    ]);
    const context = createContext({ minMappingQuality: 1 });
    const first = await fetchBam(context);
    expect(first.map((record) => record.start)).toEqual([20]);

    await fetchBam({ ...context, demand: { ...context.demand, region } });
    expect(reader.createBamFile).toHaveBeenCalledTimes(1);
  });

  it("keeps every record when no mapping quality is required", async () => {
    reader.read.mockResolvedValue([
      alignment(10, [{ operation: "M", length: 10 }], { mappingQuality: 0 }),
    ]);
    expect(await fetchBam(createContext())).toHaveLength(1);
  });

  it("passes the index url through when configured", async () => {
    reader.read.mockResolvedValue([]);
    await fetchBam(createContext({ indexUrl: "https://example.test/custom.bai" }));
    expect(reader.createBamFile).toHaveBeenCalledWith({
      url: "https://example.test/reads.bam",
      indexUrl: "https://example.test/custom.bai",
    });
  });
});

describe("BAM coverage", () => {
  it("counts aligned bases and skips introns and deletions", () => {
    const records = [
      // 10M5N10M: covers [0,10) and [15,25), not the 5-base gap.
      alignment(0, [
        { operation: "M", length: 10 },
        { operation: "N", length: 5 },
        { operation: "M", length: 10 },
      ]),
      alignment(5, [{ operation: "M", length: 10 }]), // covers [5,15)
    ];
    const runs = computeCoverageRuns(records, { chromosome: "chr1", start: 0, end: 30 });
    const depthAt = (position: number) =>
      runs.find((run) => run.start <= position && position < run.end)?.value ?? 0;

    expect(depthAt(0)).toBe(1); // first read only
    expect(depthAt(7)).toBe(2); // both reads overlap
    expect(depthAt(12)).toBe(1); // second read only; first is in its N gap
    expect(depthAt(16)).toBe(1); // first read resumes after the intron
    expect(depthAt(26)).toBe(0); // past both reads
  });

  it("ignores insertions and clipping, which do not consume the reference", () => {
    const runs = computeCoverageRuns(
      [
        alignment(0, [
          { operation: "S", length: 5 },
          { operation: "M", length: 10 },
          { operation: "I", length: 4 },
          { operation: "M", length: 10 },
        ]),
      ],
      { chromosome: "chr1", start: 0, end: 40 },
    );
    // 20 aligned bases starting at 0, the insertion adding no reference span.
    expect(runs).toEqual([{ kind: "value", chromosome: "chr1", start: 0, end: 20, value: 1 }]);
  });

  it("clips coverage to the requested region", () => {
    const runs = computeCoverageRuns([alignment(0, [{ operation: "M", length: 100 }])], {
      chromosome: "chr1",
      start: 20,
      end: 40,
    });
    expect(runs).toEqual([{ kind: "value", chromosome: "chr1", start: 20, end: 40, value: 1 }]);
  });

  it("returns nothing when no read aligns", () => {
    expect(computeCoverageRuns([], region)).toEqual([]);
  });
});

describe("BAM junctions", () => {
  it("tallies N gaps by their exact coordinates", () => {
    const spliced = [
      { operation: "M", length: 10 },
      { operation: "N", length: 50 },
      { operation: "M", length: 10 },
    ] satisfies Cigar;
    const junctions = computeJunctions([
      alignment(100, spliced),
      alignment(100, spliced),
      alignment(300, spliced),
    ]);
    expect(junctions).toEqual([
      { start: 110, end: 160, count: 2 },
      { start: 310, end: 360, count: 1 },
    ]);
  });

  it("advances past deletions when placing a junction", () => {
    // 10M5D10N10M puts the junction at 100+10+5 = 115, not 110.
    expect(
      computeJunctions([
        alignment(100, [
          { operation: "M", length: 10 },
          { operation: "D", length: 5 },
          { operation: "N", length: 10 },
          { operation: "M", length: 10 },
        ]),
      ]),
    ).toEqual([{ start: 115, end: 125, count: 1 }]);
  });

  it("finds no junctions in unspliced reads", () => {
    expect(computeJunctions([alignment(0, [{ operation: "M", length: 50 }])])).toEqual([]);
  });

  it("applies the read-count and span filters", () => {
    const junctions = [
      { start: 0, end: 100, count: 1 },
      { start: 0, end: 5000, count: 20 },
      { start: 10, end: 60, count: 9 },
    ];
    expect(filterJunctions(junctions, { minJunctionReads: 5 })).toHaveLength(2);
    expect(filterJunctions(junctions, { minJunctionReads: 1, maxJunctionSpan: 1000 })).toEqual([
      { start: 0, end: 100, count: 1 },
      { start: 10, end: 60, count: 9 },
    ]);
  });
});

describe("BAM pileup sampling", () => {
  it("keeps every read below the cap", () => {
    const records = Array.from({ length: 5 }, (_, index) =>
      alignment(index * 10, [{ operation: "M", length: 5 }]),
    );
    expect(sampleReads(records, 10)).toHaveLength(5);
  });

  it("samples evenly across the window rather than taking a prefix", () => {
    const records = Array.from({ length: 100 }, (_, index) =>
      alignment(index * 10, [{ operation: "M", length: 5 }]),
    );
    const sampled = sampleReads(records, 10);
    expect(sampled.length).toBeLessThanOrEqual(10);
    // The sample spans the whole window: a prefix of ten would stop at 90.
    expect(sampled[0]!.start).toBe(0);
    expect(sampled.at(-1)!.start).toBe(900);
  });
});

describe("BAM junction arc layout", () => {
  const options = { region: { start: 0, end: 1000 }, width: 1000, height: 100 };

  it("places the label at the curve's own peak, not at the control point", () => {
    const [arc] = layoutJunctionArcs([{ start: 100, end: 900, count: 5 }], options);
    // A quadratic curve reaches half way to its control point, so the peak sits
    // midway between the baseline and controlY.
    const baseline = options.height - 2;
    expect(arc!.peakY).toBeCloseTo((baseline + arc!.controlY) / 2, 5);
    expect(arc!.peakY).toBeGreaterThan(arc!.controlY);
  });

  it("raises wider junctions above narrower ones", () => {
    const arcs = layoutJunctionArcs(
      [
        { start: 100, end: 150, count: 5 },
        { start: 100, end: 900, count: 5 },
      ],
      options,
    );
    const [narrow, wide] = arcs;
    // Smaller y is higher on the screen.
    expect(wide!.peakY).toBeLessThan(narrow!.peakY);
  });

  it("keeps every arc inside the track", () => {
    const arcs = layoutJunctionArcs(
      [
        { start: 0, end: 1000, count: 900 },
        { start: 400, end: 402, count: 1 },
      ],
      options,
    );
    for (const arc of arcs) {
      expect(arc.peakY).toBeGreaterThanOrEqual(0);
      expect(arc.peakY).toBeLessThanOrEqual(options.height);
    }
  });

  it("drops labels that would collide, keeping the highest counts", () => {
    // Five junctions sharing a midpoint and span: every label would land on the
    // same spot, so only the largest count survives.
    const stacked = [
      { start: 500, end: 520, count: 3 },
      { start: 499, end: 521, count: 40 },
      { start: 501, end: 519, count: 7 },
    ];
    const arcs = layoutJunctionArcs(stacked, options);
    const labelled = arcs.filter((arc) => arc.showLabel);
    expect(labelled).toHaveLength(1);
    expect(labelled[0]!.junction.count).toBe(40);
    // Every arc is still drawn; only the numbers are thinned.
    expect(arcs).toHaveLength(3);
  });

  it("labels junctions that are far enough apart", () => {
    const arcs = layoutJunctionArcs(
      [
        { start: 10, end: 60, count: 5 },
        { start: 800, end: 850, count: 5 },
      ],
      options,
    );
    expect(arcs.every((arc) => arc.showLabel)).toBe(true);
  });

  it("scales stroke width with the log of the count", () => {
    const arcs = layoutJunctionArcs(
      [
        { start: 0, end: 500, count: 1 },
        { start: 0, end: 500, count: 500 },
      ],
      options,
    );
    expect(arcs[0]!.strokeWidth).toBeLessThan(arcs[1]!.strokeWidth);
    expect(arcs[1]!.strokeWidth).toBeCloseTo(4, 1);
  });
});
