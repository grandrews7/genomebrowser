import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import {
  defineTrackModule,
  fetchOnChange,
  useTooltip,
  type TrackFetchContext,
  type TrackRendererProps,
  type TrackSettingsProps,
} from "@weng-lab/genomebrowser";
import {
  TrackBaseSettings,
  TrackHeightSettings,
  TrackSettingsFieldGrid,
  TrackSettingsFullRow,
  TrackSettingsLayout,
  TrackSettingsNumberField,
  TrackSettingsSection,
  TrackSettingsUrlField,
} from "@weng-lab/genomebrowser-tracks/shared";
import { AxiosDataLoader, BamReader, type BamAlignment } from "genomic-reader";
import { useState, type ReactNode } from "react";
import { z } from "zod";

/**
 * BAM track: coverage, read pileup, and sashimi arcs, all derived on the fly
 * from the alignments in view. BAM is the sole data source (no precomputed
 * bigWig/bigBed), so everything is zoom-gated: past each mode's threshold we
 * skip the (heavy) read fetch.
 *
 * display modes:
 *   "coverage" (default) - histogram of per-base depth, computed from CIGAR
 *   "pileup"             - stacked reads (IGV-style)
 *   "both"               - coverage on top, reads below
 *   "sashimi"            - coverage on top, splice-junction arcs below
 *
 * This is the one place that still uses the legacy unscoped `genomic-reader`:
 * `@weng-lab/genomic-reader` reads bigWig/bigBed/2bit/chrom sizes but has no
 * BAM reader, and BAM is the whole point of this module.
 */

const configSchema = z.object({
  bamUrl: fetchOnChange(z.string().min(1)),
  baiUrl: fetchOnChange(z.string().optional()),
  // Marked: the fetch gate is the widest threshold among the views this mode
  // shows, so switching modes must re-request.
  display: fetchOnChange(z.enum(["coverage", "pileup", "both", "sashimi"]).default("coverage")),
  // Coverage is derived from the BAM by reading every alignment in the window,
  // then binning. genomic-reader's read() has no limit/downsample hook, so the
  // whole window's reads materialize in memory - on a very dense gene (e.g. ALB
  // in HepG2) a wide window can exhaust the tab. This cap is the safe ceiling
  // for pure-BAM coverage; beyond it we show "zoom in" rather than attempt the
  // fetch. Raise it only if your BAMs aren't deeply covered.
  coverageMaxBases: fetchOnChange(z.number().default(25000)),
  maxBases: fetchOnChange(z.number().default(20000)), // pileup zoom gate (tight)
  sashimiMaxBases: fetchOnChange(z.number().default(100000)), // sashimi zoom gate
  // 0 keeps multi-mappers (MAPQ 0). Applied in fetch, so it is marked.
  minMapq: fetchOnChange(z.number().default(1)),
  maxSpan: z.number().default(30000), // drop paralog-crossing arcs
  maxReads: z.number().default(400),
  // Plus-strand reads use the track's base color, so it is not duplicated here.
  minusColor: z.string().default("#d08b5b"),
  coverageColor: z.string().default("#3a6ea5"),
});

type Config = z.infer<typeof configSchema>;
type Data = BamAlignment[];

const READER_KEY = "bam-reader";
type ReaderEntry = { bamUrl: string; baiUrl: string; reader: BamReader };

/**
 * Per-BIN coverage over [start,end), binned to `nBins` (~pixel columns).
 * Uses a difference array: each aligned segment contributes two O(1) updates
 * (not one-per-base), so cost is O(reads x cigarOps + nBins) instead of
 * O(total aligned bases). This keeps coverage fast even over a wide window on a
 * very highly-expressed gene (e.g. ALB in HepG2), while still counting every
 * read - no downsampling, so the depth is exact at bin resolution.
 * N (splice) and D (deletion) advance the reference without adding depth.
 */
function computeBinnedCoverage(
  reads: BamAlignment[],
  start: number,
  end: number,
  nBins: number,
): number[] {
  const span = Math.max(1, end - start);
  const binOf = (pos: number) =>
    Math.min(nBins - 1, Math.max(0, Math.floor(((pos - start) / span) * nBins)));
  // diff[i] += d means "depth rises by d starting at bin i"; prefix-sum later.
  const diff = new Float64Array(nBins + 1);
  for (const read of reads) {
    let ref = read.start;
    for (const op of read.cigarOps) {
      if (op.op === "M" || op.op === "=" || op.op === "X") {
        const segmentStart = ref;
        const segmentEnd = ref + op.opLen;
        if (segmentEnd > start && segmentStart < end) {
          diff[binOf(segmentStart)] += 1;
          diff[binOf(segmentEnd - 1) + 1] -= 1;
        }
        ref += op.opLen;
      } else if (op.op === "N" || op.op === "D") {
        ref += op.opLen;
      }
    }
  }
  const coverage = Array.from({ length: nBins }, () => 0);
  let running = 0;
  for (let i = 0; i < nBins; i++) {
    running += diff[i];
    coverage[i] = running;
  }
  return coverage;
}

/**
 * Splice junctions (N gaps) tallied from the reads currently in view.
 * Counts are view-local: exact for the visible window, not genome-wide, and
 * they move as you pan. Junctions whose reads sit outside the fetched region
 * are undercounted.
 */
function junctionsFromReads(
  reads: BamAlignment[],
): { start: number; end: number; count: number }[] {
  const tally = new Map<string, number>();
  for (const read of reads) {
    let ref = read.start;
    for (const op of read.cigarOps) {
      if (op.op === "M" || op.op === "=" || op.op === "X" || op.op === "D") {
        ref += op.opLen;
      } else if (op.op === "N") {
        const key = `${ref}-${ref + op.opLen}`;
        tally.set(key, (tally.get(key) ?? 0) + 1);
        ref += op.opLen;
      }
    }
  }
  return [...tally.entries()].map(([key, count]) => {
    const [start, end] = key.split("-").map(Number);
    return { start, end, count };
  });
}

/** Greedy row-packing for pileup. */
function packRows(reads: BamAlignment[], gap: number): number[] {
  const rowEnds: number[] = [];
  const rowOf: number[] = [];
  for (const read of reads) {
    const end = read.start + read.lengthOnRef;
    let placed = rowEnds.findIndex((rowEnd) => read.start > rowEnd + gap);
    if (placed === -1) {
      placed = rowEnds.length;
      rowEnds.push(end);
    } else {
      rowEnds[placed] = end;
    }
    rowOf.push(placed);
  }
  return rowOf;
}

/** Arc thickness scales with log count so a 500-read junction doesn't dwarf a 5-read one. */
function arcStroke(count: number, maxCount: number) {
  return 0.75 + (Math.log1p(count) / Math.log1p(maxCount)) * 3.25;
}

function CoverageArea({
  reads,
  region,
  width,
  height,
  color,
}: {
  reads: BamAlignment[];
  region: { start: number; end: number };
  width: number;
  height: number;
  color: string;
}) {
  // One bin per pixel column: compute coverage at display resolution, so the
  // cost scales with pixels (~width), not with the genomic span.
  const nBins = Math.max(1, Math.min(2000, Math.floor(width)));
  const coverage = computeBinnedCoverage(reads, region.start, region.end, nBins);
  const max = coverage.reduce((running, value) => (value > running ? value : running), 1);
  let path = `M 0 ${height}`;
  for (let i = 0; i < nBins; i++) {
    const x = (i / nBins) * width;
    const y = height - (coverage[i] / max) * height;
    path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  path += ` L ${width} ${height} Z`;
  return (
    <>
      <path d={path} fill={color} opacity={0.85} />
      <text x={2} y={10} fontSize={10} fill="#666">
        {max}
      </text>
    </>
  );
}

function Pileup({
  reads,
  region,
  width,
  height,
  config,
  color: plusColor,
  tooltip,
}: {
  reads: BamAlignment[];
  region: { start: number; end: number };
  width: number;
  height: number;
  config: Config;
  color: string;
  tooltip: ReturnType<typeof useTooltip<BamAlignment, Config>>;
}) {
  const bases = region.end - region.start;
  const toX = (pos: number) => ((pos - region.start) / bases) * width;
  // If more reads than the cap, sample EVENLY across the region rather than
  // taking the first N (which come back sorted by start and would all cluster
  // on the left, hiding reads under the rest of the coverage).
  const capped =
    reads.length <= config.maxReads
      ? reads
      : reads.filter((_, index) => index % Math.ceil(reads.length / config.maxReads) === 0);
  const rowOf = packRows(capped, 2);
  const rowCount = Math.max(1, ...rowOf.map((row) => row + 1));
  const rowHeight = Math.max(2, Math.min(10, (height - 2) / rowCount));
  const readHeight = Math.max(1, rowHeight - 1);

  return (
    <>
      {capped.map((read, index) => {
        const y = rowOf[index] * rowHeight;
        const color = read.strand ? plusColor : config.minusColor;
        const segments: ReactNode[] = [];
        let ref = read.start;
        read.cigarOps.forEach((op, key) => {
          if (op.op === "M" || op.op === "=" || op.op === "X") {
            const x = toX(ref);
            const segmentWidth = Math.max(0.5, toX(ref + op.opLen) - x);
            segments.push(
              <rect key={key} x={x} y={y} width={segmentWidth} height={readHeight} fill={color} />,
            );
            ref += op.opLen;
          } else if (op.op === "N") {
            segments.push(
              <line
                key={key}
                x1={toX(ref)}
                y1={y + readHeight / 2}
                x2={toX(ref + op.opLen)}
                y2={y + readHeight / 2}
                stroke="#bbb"
                strokeWidth={1}
              />,
            );
            ref += op.opLen;
          } else if (op.op === "D") {
            ref += op.opLen;
          }
        });
        return (
          <g
            key={read.readName + index}
            onMouseEnter={(event) => tooltip.show(read, event)}
            onMouseLeave={tooltip.hide}
            style={{ cursor: "pointer" }}
          >
            {segments}
          </g>
        );
      })}
      {capped.length < reads.length && (
        <text x={2} y={height - 2} fontSize={10} fill="#999">
          showing {capped.length} of {reads.length} reads
        </text>
      )}
    </>
  );
}

function Sashimi({
  reads,
  region,
  width,
  height,
  color,
  maxSpan,
}: {
  reads: BamAlignment[];
  region: { start: number; end: number };
  width: number;
  height: number;
  color: string;
  maxSpan: number;
}) {
  const bases = region.end - region.start;
  const toX = (pos: number) => ((pos - region.start) / bases) * width;
  const junctions = junctionsFromReads(reads).filter(
    (junction) =>
      junction.end >= region.start &&
      junction.start <= region.end &&
      junction.end - junction.start <= maxSpan,
  );
  if (junctions.length === 0) return null;
  const maxCount = junctions.reduce(
    (running, junction) => (junction.count > running ? junction.count : running),
    1,
  );
  const baseline = height - 2;
  const apexY = 12;
  return (
    <>
      {junctions.map((junction) => {
        const x1 = toX(junction.start);
        const x2 = toX(junction.end);
        const midX = (x1 + x2) / 2;
        return (
          <g key={`${junction.start}-${junction.end}`}>
            <path
              d={`M ${x1} ${baseline} Q ${midX} ${apexY} ${x2} ${baseline}`}
              fill="none"
              stroke={color}
              strokeWidth={arcStroke(junction.count, maxCount)}
              opacity={0.85}
            />
            <text x={midX} y={apexY - 2} textAnchor="middle" fontSize={10} fill={color}>
              {junction.count}
            </text>
          </g>
        );
      })}
    </>
  );
}

function BamRenderer({
  color,
  config,
  data,
  region,
  width,
  height,
}: TrackRendererProps<Config, Data>) {
  const tooltip = useTooltip<BamAlignment, Config>();
  const bases = region.end - region.start;

  // Coverage shows across the widest gate; beyond THAT there is nothing to
  // draw, because fetch returned no reads.
  if (bases > config.coverageMaxBases) {
    return (
      <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={12} fill="#999">
        Zoom in below {config.coverageMaxBases.toLocaleString("en-US")} bp to see signal
      </text>
    );
  }
  if (data.length === 0) return null;

  const mode = config.display;
  // Coverage always renders here. Pileup and sashimi are additionally gated by
  // their own (tighter) thresholds, so zooming out progressively drops reads,
  // then arcs, leaving the coverage signal - like a normal browser.
  const showArcs = (mode === "sashimi" || mode === "both") && bases <= config.sashimiMaxBases;
  const showReads = (mode === "pileup" || mode === "both") && bases <= config.maxBases;
  const showLower = showArcs || showReads;

  // Layout: coverage takes a top slice when anything is shown below it.
  const coverageHeight = showLower ? Math.round(height * 0.4) : height;
  const lowerY = coverageHeight + 4;
  const lowerHeight = height - lowerY;
  // When both arcs and reads share the lower area, split it.
  const arcHeight = showArcs && showReads ? Math.round(lowerHeight * 0.45) : lowerHeight;
  const readsY = showArcs && showReads ? lowerY + arcHeight + 2 : lowerY;
  const readsHeight = showArcs && showReads ? lowerHeight - arcHeight - 2 : lowerHeight;

  return (
    <>
      <CoverageArea
        reads={data}
        region={region}
        width={width}
        height={coverageHeight}
        color={config.coverageColor}
      />

      {showArcs && (
        <g transform={`translate(0, ${lowerY})`}>
          <Sashimi
            reads={data}
            region={region}
            width={width}
            height={arcHeight}
            color={config.coverageColor}
            maxSpan={config.maxSpan}
          />
        </g>
      )}

      {showReads && (
        <g transform={`translate(0, ${readsY})`}>
          <Pileup
            reads={data}
            region={region}
            width={width}
            height={readsHeight}
            config={config}
            color={color}
            tooltip={tooltip}
          />
        </g>
      )}
    </>
  );
}

function BamSettings({
  track,
  updateTrack,
  ...settings
}: TrackSettingsProps<Config, BamAlignment>) {
  const { config, source } = track;
  const [modeError, setModeError] = useState<string>();

  return (
    <TrackSettingsLayout>
      <TrackBaseSettings
        track={track}
        updateTrack={updateTrack}
        displayOptions={settings.displayOptions}
      >
        <TrackHeightSettings track={track} updateTrack={updateTrack} {...settings} />
      </TrackBaseSettings>

      <TrackSettingsSection title="BAM source">
        <TrackSettingsFieldGrid>
          <TrackSettingsFullRow>
            <TrackSettingsUrlField
              label="BAM URL"
              disabled={source === "host"}
              required
              value={config.bamUrl}
              onCommit={(bamUrl) => updateTrack({ config: { bamUrl } })}
            />
          </TrackSettingsFullRow>
          <TrackSettingsFullRow>
            <TrackSettingsUrlField
              label="Index URL"
              placeholder="Defaults to the BAM URL plus .bai"
              disabled={source === "host"}
              value={config.baiUrl ?? ""}
              onCommit={(baiUrl) =>
                updateTrack({ config: { baiUrl: baiUrl.trim() === "" ? undefined : baiUrl } })
              }
            />
          </TrackSettingsFullRow>
        </TrackSettingsFieldGrid>
      </TrackSettingsSection>

      <TrackSettingsSection title="Rendering">
        <TrackSettingsFieldGrid>
          <TrackSettingsFullRow>
            <TextField
              select
              fullWidth
              size="small"
              label="Mode"
              value={config.display}
              error={modeError !== undefined}
              helperText={modeError ?? "Coverage always draws; reads and arcs appear below it."}
              onChange={(event) => {
                const result = updateTrack({
                  config: { display: event.target.value as Config["display"] },
                });
                setModeError(result.ok ? undefined : result.error);
              }}
            >
              <MenuItem value="coverage">Coverage</MenuItem>
              <MenuItem value="pileup">Reads</MenuItem>
              <MenuItem value="both">Coverage and reads</MenuItem>
              <MenuItem value="sashimi">Coverage and junction arcs</MenuItem>
            </TextField>
          </TrackSettingsFullRow>
          <TrackSettingsNumberField
            label="Minimum MAPQ"
            min={0}
            step={1}
            inputMode="numeric"
            value={config.minMapq}
            validate={(value) => (value >= 0 ? undefined : "Enter a mapping quality of 0 or more.")}
            onCommit={(minMapq) => updateTrack({ config: { minMapq } })}
          />
          <TrackSettingsNumberField
            label="Maximum reads drawn"
            min={1}
            step={1}
            inputMode="numeric"
            value={config.maxReads}
            validate={(value) => (value >= 1 ? undefined : "Draw at least one read.")}
            onCommit={(maxReads) => updateTrack({ config: { maxReads } })}
          />
          <TrackSettingsNumberField
            label="Maximum arc span (bp)"
            min={1}
            step={1}
            inputMode="numeric"
            value={config.maxSpan}
            validate={(value) => (value >= 1 ? undefined : "Enter a span of at least 1 bp.")}
            onCommit={(maxSpan) => updateTrack({ config: { maxSpan } })}
          />
        </TrackSettingsFieldGrid>
      </TrackSettingsSection>

      <TrackSettingsSection title="Zoom gates">
        <TrackSettingsFieldGrid>
          <TrackSettingsNumberField
            label="Coverage below (bp)"
            min={1}
            step={1}
            inputMode="numeric"
            value={config.coverageMaxBases}
            validate={(value) => (value >= 1 ? undefined : "Enter a width of at least 1 bp.")}
            onCommit={(coverageMaxBases) => updateTrack({ config: { coverageMaxBases } })}
          />
          <TrackSettingsNumberField
            label="Reads below (bp)"
            min={1}
            step={1}
            inputMode="numeric"
            value={config.maxBases}
            validate={(value) => (value >= 1 ? undefined : "Enter a width of at least 1 bp.")}
            onCommit={(maxBases) => updateTrack({ config: { maxBases } })}
          />
          <TrackSettingsNumberField
            label="Arcs below (bp)"
            min={1}
            step={1}
            inputMode="numeric"
            value={config.sashimiMaxBases}
            validate={(value) => (value >= 1 ? undefined : "Enter a width of at least 1 bp.")}
            onCommit={(sashimiMaxBases) => updateTrack({ config: { sashimiMaxBases } })}
          />
        </TrackSettingsFieldGrid>
      </TrackSettingsSection>
    </TrackSettingsLayout>
  );
}

/**
 * Declared standalone, and referenced as `fetch: fetchBamReads` below, so that
 * its concrete `Promise<Data>` return type survives into `defineTrackModule`.
 * Inlining it as a method makes the data generic widen to `unknown` and the
 * renderer stop matching - the same inference gap the first-party modules avoid
 * by declaring their fetchers this way.
 */
async function fetchBamReads({
  track: { config },
  demand: { region },
  resources,
}: TrackFetchContext<Config>): Promise<Data> {
  // Fetch reads if ANY enabled view is in range. Coverage (part of every
  // mode) has the widest gate, so effectively: fetch when within the widest
  // of the views currently shown.
  const gates = [config.coverageMaxBases];
  if (config.display === "pileup" || config.display === "both") gates.push(config.maxBases);
  if (config.display === "sashimi" || config.display === "both") gates.push(config.sashimiMaxBases);
  if (region.end - region.start > Math.max(...gates)) return [];

  const baiUrl = config.baiUrl ?? `${config.bamUrl}.bai`;
  let entry = resources.get<ReaderEntry>(READER_KEY);
  if (!entry || entry.bamUrl !== config.bamUrl || entry.baiUrl !== baiUrl) {
    entry = {
      bamUrl: config.bamUrl,
      baiUrl,
      reader: new BamReader(new AxiosDataLoader(config.bamUrl), new AxiosDataLoader(baiUrl)),
    };
    resources.set(READER_KEY, entry);
  }

  let reads: BamAlignment[];
  try {
    reads = await entry.reader.read(region.chromosome, region.start, region.end);
  } catch {
    return []; // chromosome not in BAM, or read failure - treat as no data
  }
  // Drop low-MAPQ (multi-mapping) reads - at paralogs like SMN these are the
  // ambiguous SMN1/SMN2 reads that create spurious long-range junctions.
  return config.minMapq > 0 ? reads.filter((read) => read.mappingQuality >= config.minMapq) : reads;
}

export const bamModule = defineTrackModule<BamAlignment>()({
  type: "bam",
  defaults: { height: 200, color: "#5b8bd0" },
  configSchema,
  fetch: fetchBamReads,
  render: { full: BamRenderer },
  settingsComponent: BamSettings,
  tooltipComponent: ({ item }) => (
    <text>
      {item.readName} · {item.strand ? "+" : "-"} · MAPQ {item.mappingQuality}
    </text>
  ),
});
