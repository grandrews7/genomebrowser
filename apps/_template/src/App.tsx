import {
  GenomeBrowser,
  createBrowserStore,
  createTrackStore,
  parseRegion,
  type AnyTrackInstance,
  type GenomicRegion,
} from "@weng-lab/genomebrowser";
import { bamModule } from "@weng-lab/genomebrowser-tracks/bam";
import { bigBedModule } from "@weng-lab/genomebrowser-tracks/bigbed";
import { bigWigModule } from "@weng-lab/genomebrowser-tracks/bigwig";
import { dynseqModule } from "@weng-lab/genomebrowser-tracks/dynseq";
import {
  geneModule,
  getGeneDatasetTitle,
  getGeneDatasetsForAssembly,
} from "@weng-lab/genomebrowser-tracks/gene";
import { useEffect, useRef, useState } from "react";
import { APP_TITLE, LOGO_ALT, LOGO_URL } from "./branding";
import { DATASETS, DEFAULT_DATASET_ID } from "./config";
import type { Dataset, DatasetOption } from "./datasets/types";

const MARGIN_WIDTH = 150;

/**
 * Dataset URLs may be page-relative, so a file in ./public can be named
 * "/reads.bam" and served by the dev server without cross-origin configuration.
 * The reader deliberately requires absolute URLs - it refuses a bare string
 * rather than quietly turning a typo into a same-origin request - so resolve
 * against the page here, where the relative form is a documented convention.
 */
const resolveUrl = (url: string) => new URL(url, window.location.href).href;

/* ------------------------------------------------------------------ *
 * Dataset validation, once on load.
 *
 * These throw rather than degrade. Every failure here produces a browser
 * that looks like it works - an empty track, or coordinates normalised
 * against the wrong assembly - which is far more expensive to diagnose
 * than a refusal to start.
 * ------------------------------------------------------------------ */

if (DATASETS.length === 0) {
  throw new Error("config.ts lists no datasets.");
}

const duplicateIds = DATASETS.map((option) => option.id).filter(
  (id, index, ids) => ids.indexOf(id) !== index,
);
if (duplicateIds.length > 0) {
  throw new Error(`Duplicate dataset ids in config.ts: ${[...new Set(duplicateIds)].join(", ")}.`);
}

/**
 * One assembly across every option. The browser store binds its assembly at
 * creation and normalises every region against it, so a second assembly would
 * silently reinterpret coordinates rather than fail.
 */
const [firstOption] = DATASETS;
const assembly = firstOption.dataset.ASSEMBLY;
const mismatched = DATASETS.filter((option) => option.dataset.ASSEMBLY.id !== assembly.id);
if (mismatched.length > 0) {
  throw new Error(
    `Every dataset in config.ts must share one assembly. "${firstOption.id}" is ${assembly.id}, ` +
      `but ${mismatched.map((option) => `"${option.id}" is ${option.dataset.ASSEMBLY.id}`).join(", ")}. ` +
      `Showing a second assembly needs a second browser store.`,
  );
}

/** Returns rather than narrows, so the type stays non-optional inside the component. */
function getDefaultOption(): DatasetOption {
  const option = DATASETS.find((candidate) => candidate.id === DEFAULT_DATASET_ID);
  if (!option) {
    throw new Error(
      `DEFAULT_DATASET_ID "${DEFAULT_DATASET_ID}" matches no dataset. ` +
        `Available: ${DATASETS.map((candidate) => candidate.id).join(", ")}.`,
    );
  }
  return option;
}
const defaultOption = getDefaultOption();

/**
 * A dataset either names its own annotation file or picks one from the packaged
 * catalog. The catalog only covers hg38 and mm10, so any other assembly has to
 * supply GENE_TRACK_URL - see tools/gtf-to-big-gene-pred-plus for building one.
 */
function getGeneAnnotation(dataset: Dataset) {
  const catalogDataset = dataset.GENE_TRACK_URL
    ? undefined
    : getGeneDatasetsForAssembly(dataset.ASSEMBLY.id).find(
        (candidate) =>
          candidate.release === dataset.GENCODE_RELEASE &&
          candidate.variant === dataset.GENE_TRACK_VARIANT,
      );
  return { catalogDataset, url: dataset.GENE_TRACK_URL ?? catalogDataset?.url };
}

for (const option of DATASETS) {
  const { dataset } = option;
  if (dataset.SHOW_GENE_TRACK && !getGeneAnnotation(dataset).url) {
    const available = getGeneDatasetsForAssembly(dataset.ASSEMBLY.id).map(getGeneDatasetTitle);
    throw new Error(
      `No annotation for ${dataset.ASSEMBLY.id} in dataset "${option.id}". Set GENE_TRACK_URL, ` +
        `or pick one of: ${available.length > 0 ? available.join(", ") : "nothing in the catalog for this assembly"}.`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * Track construction.
 * ------------------------------------------------------------------ */

/**
 * Every track a dataset asks for, as module instances.
 *
 * Called once per dataset switch and handed to `setTracks`, so it must stay a
 * pure function of the dataset: anything cached across calls would leak the
 * previous view's state into the next one.
 */
function buildTracks(dataset: Dataset): AnyTrackInstance[] {
  const { catalogDataset, url: geneTrackUrl } = getGeneAnnotation(dataset);

  const geneTracks: AnyTrackInstance[] =
    dataset.SHOW_GENE_TRACK && geneTrackUrl
      ? [
          geneModule.create({
            base: {
              id: "genes",
              title:
                dataset.GENE_TRACK_TITLE ??
                (catalogDataset ? getGeneDatasetTitle(catalogDataset) : "Genes"),
              display: dataset.GENE_TRACK_DISPLAY,
              height: dataset.GENE_TRACK_HEIGHT,
            },
            // A catalog file is ours to keep fixed; one the dataset named is the
            // user's, so its URL stays editable in the track settings.
            source: catalogDataset ? "host" : "user",
            config: {
              url: resolveUrl(geneTrackUrl),
              tagColors: dataset.GENE_TAG_COLORS,
              highlightColor: dataset.HIGHLIGHT_COLOR,
              ...(dataset.HIGHLIGHT_GENE ? { geneName: dataset.HIGHLIGHT_GENE } : {}),
            },
          }),
        ]
      : [];

  const signalTracks: AnyTrackInstance[] = dataset.SIGNAL_TRACKS.map((track) =>
    bigWigModule.create({
      base: {
        id: track.id,
        title: track.title,
        display: "full",
        height: track.height ?? 60,
        color: track.color ?? "#2266aa",
      },
      config: {
        url: resolveUrl(track.url),
        fillWithZero: true,
        ...(track.yRange ? { yRange: track.yRange } : {}),
      },
    }),
  );

  const bamTracks: AnyTrackInstance[] = dataset.BAM_TRACKS.map((track) =>
    bamModule.create({
      base: {
        id: track.id,
        title: track.title,
        // `display` now sets the read layout only; coverage and junctions are
        // sections stacked above it, each shown or hidden on its own.
        display: track.display ?? "pack",
        height: track.height ?? 180,
      },
      config: {
        url: resolveUrl(track.url),
        // The module requires an index, so fall back to the conventional name.
        indexUrl: resolveUrl(track.indexUrl ?? `${track.url}.bai`),
        ...(track.maxWindow ? { maxWindow: track.maxWindow } : {}),
        ...(track.minMappingQuality !== undefined
          ? { filters: { minimumMappingQuality: track.minMappingQuality } }
          : {}),
        coverage: {
          show: track.showCoverage ?? true,
          ...(track.coverageHeight ? { height: track.coverageHeight } : {}),
        },
        junctions: {
          show: track.showJunctions ?? false,
          ...(track.junctionHeight ? { height: track.junctionHeight } : {}),
          ...(track.minJunctionSupport ? { minimumSupport: track.minJunctionSupport } : {}),
          ...(track.maxJunctionSpan ? { maximumSpan: track.maxJunctionSpan } : {}),
        },
        alignments: {
          show: track.showAlignments ?? true,
          ...(track.maxAlignmentRows ? { maxRows: track.maxAlignmentRows } : {}),
          ...(track.alignmentRowHeight ? { rowHeight: track.alignmentRowHeight } : {}),
        },
      },
    }),
  );

  const dynseqTracks: AnyTrackInstance[] = dataset.DYNSEQ_TRACKS.map((track) =>
    dynseqModule.create({
      base: {
        id: track.id,
        title: track.title,
        display: "full",
        height: track.height ?? 110,
      },
      config: {
        url: resolveUrl(track.url),
        twoBitUrl: resolveUrl(track.twoBitUrl ?? dataset.TWO_BIT_URL),
      },
    }),
  );

  /**
   * Interval annotations: motif hits, seqlets, scored windows.
   *
   * The module has no field filter, so a threshold on a score column has to be
   * baked into the file rather than set here - see the sim0.9 variants in the
   * motif dataset. Columns past `bedSchema` still reach the tooltip untyped.
   */
  const bigBedTracks: AnyTrackInstance[] = dataset.BIGBED_TRACKS.map((track) =>
    bigBedModule.create({
      base: {
        id: track.id,
        title: track.title,
        display: track.display ?? "squish",
        height: track.height ?? 40,
        ...(track.color ? { color: track.color } : {}),
      },
      config: {
        url: resolveUrl(track.url),
        ...(track.bedSchema ? { bedSchema: track.bedSchema } : {}),
        ...(track.rowHeight ? { rowHeight: track.rowHeight } : {}),
      },
    }),
  );

  return [...geneTracks, ...signalTracks, ...bamTracks, ...dynseqTracks, ...bigBedTracks];
}

/**
 * Stores are Zustand hooks and MUST be created once, outside of render.
 * Recreating them resets the region, the tracks, and all in-flight requests.
 *
 * That is exactly why the dataset picker replaces the track list through
 * `setTracks` rather than building a store per dataset: the browser store
 * survives the switch, so the region you were looking at survives with it.
 *
 * Both are exported so the browser can be driven from outside this component -
 * moving the region, adding or updating a track - without threading callbacks
 * through it. That is the upstream store-based idiom, and it is what a test
 * drives to check the picker.
 */
export const useBrowserStore = createBrowserStore({
  assembly,
  region: parseRegion(defaultOption.dataset.INITIAL_REGION),
  marginWidth: MARGIN_WIDTH,
  trackWidth: 900,
});

/** The registry has to cover every module any dataset uses, not just the first. */
export const useTrackStore = createTrackStore({
  modules: [geneModule, bigWigModule, bamModule, dynseqModule, bigBedModule],
  tracks: buildTracks(defaultOption.dataset),
});

/**
 * Make pasted coordinates parseable. Papers, genome browsers, and macOS
 * smart-dashes all produce en/em dashes and thin spaces that the region
 * parser rejects, e.g. "chr12:120,978,543-121,002,512".
 */
const normalizeInput = (value: string) =>
  value
    .replace(/[‐-―−﹘﹣－]/g, "-") // any dash -> hyphen
    .replace(/[\s  -​,_]/g, "") // spaces, commas, underscores
    .replace(/\.\.+/g, "-") // "chr12:1..500" style
    .trim();

function formatRegion(region: GenomicRegion) {
  return `${region.chromosome}:${region.start.toLocaleString("en-US")}-${region.end.toLocaleString("en-US")}`;
}

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const region = useBrowserStore((state) => state.region);
  const setRegion = useBrowserStore((state) => state.setRegion);
  const zoom = useBrowserStore((state) => state.zoom);

  const [draft, setDraft] = useState(defaultOption.dataset.INITIAL_REGION);
  const [error, setError] = useState<string | null>(null);
  const [datasetId, setDatasetId] = useState(defaultOption.id);

  // The browser never measures its own parent - we have to tell it the width.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const { marginWidth, setTrackWidth } = useBrowserStore.getState();
      setTrackWidth(Math.max(1, entry.contentRect.width - marginWidth));
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /**
   * Swap the track list, keeping the region. `setTracks` validates against the
   * registry, so a module a dataset uses but `createTrackStore` never received
   * is reported here rather than rendering as a missing track.
   */
  const selectDataset = (id: string) => {
    const option = DATASETS.find((candidate) => candidate.id === id);
    if (!option) return;
    const result = useTrackStore.getState().setTracks(buildTracks(option.dataset));
    if (!result.ok) {
      setError(`Could not load "${option.label}": ${result.error}`);
      return;
    }
    setDatasetId(id);
    setError(null);
  };

  const go = () => {
    let parsed: GenomicRegion;
    try {
      parsed = parseRegion(normalizeInput(draft));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invalid region");
      return;
    }
    const result = setRegion(parsed);
    setError(result.ok ? null : result.error);
  };

  const pan = (fraction: number) => {
    const span = region.end - region.start;
    const shift = Math.round(span * fraction);
    const start = Math.max(0, region.start + shift);
    const result = setRegion({ chromosome: region.chromosome, start, end: start + span });
    if (!result.ok) setError(result.error);
  };

  return (
    <main>
      <header>
        <div className="masthead">
          <h1>{APP_TITLE}</h1>
          {LOGO_URL && <img className="logo" src={LOGO_URL} alt={LOGO_ALT} title={LOGO_ALT} />}
        </div>
        <div className="controls">
          {DATASETS.length > 1 && (
            <select
              className="dataset"
              aria-label="Dataset"
              value={datasetId}
              onChange={(event) => selectDataset(event.target.value)}
            >
              {DATASETS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          <input
            aria-label="Genomic region"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && go()}
            placeholder="chr12:6,534,517-6,538,374"
            spellCheck={false}
          />
          <button onClick={go}>Go</button>
          <span className="spacer" />
          <button onClick={() => pan(-0.5)} title="Pan left">
            &larr;
          </button>
          <button onClick={() => zoom(0.5)} title="Zoom in">
            +
          </button>
          <button onClick={() => zoom(2)} title="Zoom out">
            &minus;
          </button>
          <button onClick={() => pan(0.5)} title="Pan right">
            &rarr;
          </button>
        </div>
        <p className="readout">
          <span className="assembly">{assembly.id}</span>
          {formatRegion(region)}{" "}
          <span className="dim">({(region.end - region.start).toLocaleString("en-US")} bp)</span>
        </p>
        {error && <p className="error">{error}</p>}
      </header>

      <div ref={containerRef} className="browser">
        <GenomeBrowser browserStore={useBrowserStore} trackStore={useTrackStore} />
      </div>
    </main>
  );
}
