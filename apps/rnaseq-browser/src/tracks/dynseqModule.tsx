import {
  defineTrackModule,
  fetchOnChange,
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
import {
  createBigWigFile,
  createTwoBitFile,
  type BigWigFile,
  type TwoBitFile,
} from "@weng-lab/genomic-reader";
import { z } from "zod";

/**
 * dynseq track (after Kundaje et al.): a per-base bigWig (phyloP, model
 * importance scores, ...) shown as a filled signal when zoomed out, and as
 * colored nucleotide LETTERS scaled by score when zoomed in - negatives below
 * the axis.
 *
 * The glyph shapes are the weng-lab LogoJS nucleotide paths (100x100 box),
 * extracted and rendered directly here as React-19-native SVG. (logojs-react's
 * own components are built against React 16 and don't render under React 19, so
 * we reuse only the letter geometry, not its React wrapper.)
 *
 * Needs two files: the scores bigWig and a genome 2bit, both range-read.
 * Switch to letters is screen-adaptive via pixels-per-base.
 */

// LogoJS glyph geometry (weng-lab/logojs-package), each in a 100x100 box.
const GLYPHS: Record<string, { d: string; fill?: string }[]> = {
  A: [
    { d: "M 0 100 L 33 0 L 66 0 L 100 100 L 75 100 L 66 75 L 33 75 L 25 100 L 0 100" },
    { d: "M 41 55 L 50 25 L 58 55 L 41 55", fill: "#ffffff" },
  ],
  C: [
    {
      d: "M 100 28 C 100 -13 0 -13 0 50 C 0 113 100 113 100 72 L 75 72 C 75 90 30 90 30 50 C 30 10 75 10 75 28 L 100 28",
    },
  ],
  G: [
    {
      d: "M 100 28 C 100 -13 0 -13 0 50 C 0 113 100 113 100 72 L 100 48 L 55 48 L 55 72 L 75 72 C 75 90 30 90 30 50 C 30 10 75 5 75 28 L 100 28",
    },
  ],
  T: [{ d: "M 0 0 L 0 20 L 35 20 L 35 100 L 65 100 L 65 20 L 100 20 L 100 0 L 0 0" }],
};

// Base colors from LogoJS DNAAlphabet.
const BASE_COLOR: Record<string, string> = {
  A: "red",
  C: "blue",
  G: "orange",
  T: "#228b22",
};

type DynseqDatum = { position: number; score: number; base: string };
type Data = DynseqDatum[];

const configSchema = z.object({
  bigwigUrl: fetchOnChange(z.string().min(1)),
  twoBitUrl: fetchOnChange(z.string().min(1)),
  minPixelsPerBase: z.number().default(3),
  maxLetterBases: z.number().default(500),
});

type Config = z.infer<typeof configSchema>;

const FILES_KEY = "dynseq-files";
type FileEntry = {
  bigwigUrl: string;
  twoBitUrl: string;
  bigwig: BigWigFile;
  twoBit: TwoBitFile;
};

/**
 * One nucleotide glyph, scaled into a cell of the given pixel width/height,
 * flipped below the baseline for negative scores.
 */
function Glyph({
  base,
  x,
  cellWidth,
  pixelHeight,
  baseline,
  negative,
}: {
  base: string;
  x: number;
  cellWidth: number;
  pixelHeight: number;
  baseline: number;
  negative: boolean;
}) {
  const paths = GLYPHS[base];
  if (!paths || pixelHeight <= 0) return null;
  const color = BASE_COLOR[base] ?? "#666";
  // Glyph box: y=0 letter-top, y=100 letter-bottom, upright, and a positive y
  // scale keeps it upright. Positive score: the letter sits ABOVE the baseline,
  // so its top is at (baseline - pixelHeight) and it extends down to baseline.
  // Negative: it hangs BELOW, top at baseline extending down.
  const topY = negative ? baseline : baseline - pixelHeight;
  return (
    <g transform={`translate(${x}, ${topY}) scale(${cellWidth / 100}, ${pixelHeight / 100})`}>
      {paths.map((path, index) => (
        <path key={index} d={path.d} fill={path.fill ?? color} />
      ))}
    </g>
  );
}

function DynseqRenderer({
  color,
  config,
  data,
  region,
  visibleRegion,
  width,
  height,
}: TrackRendererProps<Config, Data>) {
  if (data.length === 0) return null;

  // `region` is the overscanned render window (core expands the viewport 3x for
  // panning) and pairs with `width`, so it is what horizontal coordinates and
  // the on-screen scale are built from. Whether to switch to letters is a
  // viewport question, though, so it is measured against `visibleRegion` - using
  // `region` there would demand a 3x smaller window than `maxLetterBases` says.
  const bases = region.end - region.start;
  const pixelsPerBase = width / Math.max(1, bases);
  const visibleBases = visibleRegion.end - visibleRegion.start;
  const showLetters =
    pixelsPerBase >= config.minPixelsPerBase && visibleBases <= config.maxLetterBases;

  // Max absolute score, computed WITHOUT spreading the array into Math.max -
  // `Math.max(...arr)` overflows the call stack for large arrays (a wide window
  // over a genome-wide bigWig returns tens of thousands of points). Loop instead.
  let maxAbs = 1e-6;
  for (const datum of data) {
    const absolute = Math.abs(datum.score);
    if (absolute > maxAbs) maxAbs = absolute;
  }
  const mid = height / 2;
  const toX = (pos: number) => ((pos - region.start) / bases) * width;

  if (!showLetters) {
    // Filled signal area with a zero-line; negatives below.
    let path = `M ${toX(region.start)} ${mid}`;
    for (const point of data) {
      const x = toX(point.position);
      const y = mid - (point.score / maxAbs) * (height / 2);
      path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    path += ` L ${toX(region.end)} ${mid} Z`;
    return (
      <>
        <line x1={0} y1={mid} x2={width} y2={mid} stroke="#ccc" strokeWidth={0.5} />
        <path d={path} fill={color} opacity={0.8} />
        <text x={2} y={10} fontSize={10} fill="#666">
          {maxAbs.toFixed(2)}
        </text>
      </>
    );
  }

  // Letter mode: one glyph per base, height scaled by |score|/maxAbs.
  const cellWidth = width / data.length;
  const halfHeight = height / 2;
  return (
    <>
      <line x1={0} y1={mid} x2={width} y2={mid} stroke="#ccc" strokeWidth={0.5} />
      {data.map((point) => {
        const base = point.base.toUpperCase();
        if (!GLYPHS[base]) return null;
        return (
          <Glyph
            key={point.position}
            base={base}
            x={toX(point.position)}
            cellWidth={cellWidth}
            pixelHeight={(Math.abs(point.score) / maxAbs) * halfHeight}
            baseline={mid}
            negative={point.score < 0}
          />
        );
      })}
    </>
  );
}

function DynseqSettings({
  track,
  updateTrack,
  ...settings
}: TrackSettingsProps<Config, DynseqDatum>) {
  const { config, source } = track;

  return (
    <TrackSettingsLayout>
      <TrackBaseSettings
        track={track}
        updateTrack={updateTrack}
        displayOptions={settings.displayOptions}
      >
        <TrackHeightSettings track={track} updateTrack={updateTrack} {...settings} />
      </TrackBaseSettings>

      <TrackSettingsSection title="dynseq source">
        <TrackSettingsFieldGrid>
          <TrackSettingsFullRow>
            <TrackSettingsUrlField
              label="Scores BigWig URL"
              disabled={source === "host"}
              required
              value={config.bigwigUrl}
              onCommit={(bigwigUrl) => updateTrack({ config: { bigwigUrl } })}
            />
          </TrackSettingsFullRow>
          <TrackSettingsFullRow>
            <TrackSettingsUrlField
              label="Genome 2bit URL"
              disabled={source === "host"}
              required
              value={config.twoBitUrl}
              onCommit={(twoBitUrl) => updateTrack({ config: { twoBitUrl } })}
            />
          </TrackSettingsFullRow>
        </TrackSettingsFieldGrid>
      </TrackSettingsSection>

      <TrackSettingsSection title="Letters">
        <TrackSettingsFieldGrid>
          <TrackSettingsNumberField
            label="Letters below (bp)"
            min={1}
            step={1}
            inputMode="numeric"
            value={config.maxLetterBases}
            validate={(value) => (value >= 1 ? undefined : "Enter a width of at least 1 bp.")}
            onCommit={(maxLetterBases) => updateTrack({ config: { maxLetterBases } })}
          />
          <TrackSettingsNumberField
            label="Minimum pixels per base"
            min={1}
            step="any"
            value={config.minPixelsPerBase}
            validate={(value) => (value >= 1 ? undefined : "Enter at least 1 pixel per base.")}
            onCommit={(minPixelsPerBase) => updateTrack({ config: { minPixelsPerBase } })}
          />
        </TrackSettingsFieldGrid>
      </TrackSettingsSection>
    </TrackSettingsLayout>
  );
}

/**
 * Declared standalone, and referenced as `fetch: fetchDynseqPoints` below, so
 * that its concrete `Promise<Data>` return type survives into
 * `defineTrackModule`. Inlining it as a method makes the data generic widen to
 * `unknown` and the renderer stop matching.
 */
async function fetchDynseqPoints({
  track: { config },
  demand: { region },
  resources,
}: TrackFetchContext<Config>): Promise<Data> {
  let entry = resources.get<FileEntry>(FILES_KEY);
  if (!entry || entry.bigwigUrl !== config.bigwigUrl || entry.twoBitUrl !== config.twoBitUrl) {
    entry = {
      bigwigUrl: config.bigwigUrl,
      twoBitUrl: config.twoBitUrl,
      bigwig: createBigWigFile({ url: config.bigwigUrl }),
      twoBit: createTwoBitFile({ url: config.twoBitUrl }),
    };
    resources.set(FILES_KEY, entry);
  }

  // A bigWig may not contain the requested chromosome (e.g. a locus-specific
  // track queried elsewhere), in which case the read can throw. Treat any
  // read failure as "no data here" so navigating away can't crash the app.
  let scores: Awaited<ReturnType<BigWigFile["read"]>>;
  let sequences: Awaited<ReturnType<TwoBitFile["read"]>>;
  try {
    [scores, sequences] = await Promise.all([entry.bigwig.read(region), entry.twoBit.read(region)]);
  } catch {
    return [];
  }

  // @weng-lab/genomic-reader returns one 2bit record whose `sequence` starts
  // exactly at its `start`, so scores and letters line up without the
  // off-by-one correction the legacy reader needed. Soft-masked bases come
  // back lowercase; the renderer upper-cases before glyph lookup.
  const sequence = sequences[0];
  if (!sequence) return [];

  const points: Data = [];
  for (const interval of scores) {
    for (let position = interval.start; position < interval.end; position++) {
      const index = position - sequence.start;
      if (index < 0 || index >= sequence.sequence.length) continue;
      points.push({ position, score: interval.value, base: sequence.sequence[index] });
    }
  }
  return points;
}

export const dynseqModule = defineTrackModule<DynseqDatum>()({
  type: "dynseq",
  defaults: { height: 100, color: "#3a6ea5" },
  configSchema,
  fetch: fetchDynseqPoints,
  render: { full: DynseqRenderer },
  settingsComponent: DynseqSettings,
  tooltipComponent: ({ item }) => (
    <text>
      {item.base} · {item.score.toFixed(3)}
    </text>
  ),
});
