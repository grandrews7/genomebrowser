import {
  GenomeBrowser,
  createBrowserStore,
  createTrackStore,
  parseRegion,
  type AnyTrackInstance,
  type GenomicRegion,
} from "@weng-lab/genomebrowser";
import { bamModule } from "@weng-lab/genomebrowser-tracks/bam";
import { bigWigModule } from "@weng-lab/genomebrowser-tracks/bigwig";
import { dynseqModule } from "@weng-lab/genomebrowser-tracks/dynseq";
import {
  geneModule,
  getGeneDatasetTitle,
  getGeneDatasetsForAssembly,
} from "@weng-lab/genomebrowser-tracks/gene";
import { useEffect, useRef, useState } from "react";
import {
  ASSEMBLY,
  BAM_TRACKS,
  DYNSEQ_TRACKS,
  GENCODE_RELEASE,
  GENE_TAG_COLORS,
  GENE_TRACK_DISPLAY,
  GENE_TRACK_HEIGHT,
  GENE_TRACK_TITLE,
  GENE_TRACK_URL,
  GENE_TRACK_VARIANT,
  HIGHLIGHT_COLOR,
  HIGHLIGHT_GENE,
  INITIAL_REGION,
  SHOW_GENE_TRACK,
  SIGNAL_TRACKS,
  TWO_BIT_URL,
} from "./config";

const MARGIN_WIDTH = 150;

/**
 * Dataset URLs may be page-relative, so a file in ./public can be named
 * "/reads.bam" and served by the dev server without cross-origin configuration.
 * The reader deliberately requires absolute URLs - it refuses a bare string
 * rather than quietly turning a typo into a same-origin request - so resolve
 * against the page here, where the relative form is a documented convention.
 */
const resolveUrl = (url: string) => new URL(url, window.location.href).href;

/**
 * Stores are Zustand hooks and MUST be created once, outside of render.
 * Recreating them resets the region, the tracks, and all in-flight requests.
 */
const useBrowserStore = createBrowserStore({
  assembly: ASSEMBLY,
  region: parseRegion(INITIAL_REGION),
  marginWidth: MARGIN_WIDTH,
  trackWidth: 900,
});

/**
 * A dataset either names its own annotation file or picks one from the packaged
 * catalog. The catalog only covers hg38 and mm10, so any other assembly has to
 * supply GENE_TRACK_URL - see tools/gtf-to-big-gene-pred-plus for building one.
 */
const catalogDataset = GENE_TRACK_URL
  ? undefined
  : getGeneDatasetsForAssembly(ASSEMBLY.id).find(
      (dataset) => dataset.release === GENCODE_RELEASE && dataset.variant === GENE_TRACK_VARIANT,
    );
const geneTrackUrl = GENE_TRACK_URL ?? catalogDataset?.url;

if (SHOW_GENE_TRACK && !geneTrackUrl) {
  const available = getGeneDatasetsForAssembly(ASSEMBLY.id).map(getGeneDatasetTitle);
  throw new Error(
    `No annotation for ${ASSEMBLY.id}. Set GENE_TRACK_URL in the dataset, or pick one of: ` +
      `${available.length > 0 ? available.join(", ") : "nothing in the catalog for this assembly"}.`,
  );
}

const geneTracks: AnyTrackInstance[] =
  SHOW_GENE_TRACK && geneTrackUrl
    ? [
        geneModule.create({
          base: {
            id: "genes",
            title:
              GENE_TRACK_TITLE ?? (catalogDataset ? getGeneDatasetTitle(catalogDataset) : "Genes"),
            display: GENE_TRACK_DISPLAY,
            height: GENE_TRACK_HEIGHT,
          },
          // A catalog file is ours to keep fixed; one the dataset named is the
          // user's, so its URL stays editable in the track settings.
          source: catalogDataset ? "host" : "user",
          config: {
            url: resolveUrl(geneTrackUrl),
            tagColors: GENE_TAG_COLORS,
            highlightColor: HIGHLIGHT_COLOR,
            ...(HIGHLIGHT_GENE ? { geneName: HIGHLIGHT_GENE } : {}),
          },
        }),
      ]
    : [];

const signalTracks: AnyTrackInstance[] = SIGNAL_TRACKS.map((track) =>
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

const bamTracks: AnyTrackInstance[] = BAM_TRACKS.map((track) =>
  bamModule.create({
    base: {
      id: track.id,
      title: track.title,
      display: track.display ?? "coverage",
      height: track.height ?? 180,
    },
    config: {
      url: resolveUrl(track.url),
      ...(track.indexUrl ? { indexUrl: resolveUrl(track.indexUrl) } : {}),
      ...(track.maxBases ? { maxBases: track.maxBases } : {}),
      ...(track.minMappingQuality !== undefined
        ? { minMappingQuality: track.minMappingQuality }
        : {}),
      ...(track.maxJunctionSpan ? { maxJunctionSpan: track.maxJunctionSpan } : {}),
    },
  }),
);

const dynseqTracks: AnyTrackInstance[] = DYNSEQ_TRACKS.map((track) =>
  dynseqModule.create({
    base: {
      id: track.id,
      title: track.title,
      display: "full",
      height: track.height ?? 110,
    },
    config: {
      url: resolveUrl(track.url),
      twoBitUrl: resolveUrl(track.twoBitUrl ?? TWO_BIT_URL),
    },
  }),
);

const useTrackStore = createTrackStore({
  modules: [geneModule, bigWigModule, bamModule, dynseqModule],
  tracks: [...geneTracks, ...signalTracks, ...bamTracks, ...dynseqTracks],
});

/**
 * Make pasted coordinates parseable. Papers, genome browsers, and macOS
 * smart-dashes all produce en/em dashes and thin spaces that the region
 * parser rejects, e.g. "chr12:120,978,543-121,002,512".
 */
const normalizeInput = (value: string) =>
  value
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-") // any dash -> hyphen
    .replace(/[\s\u00A0\u2000-\u200B,_]/g, "") // spaces, commas, underscores
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

  const [draft, setDraft] = useState(INITIAL_REGION);
  const [error, setError] = useState<string | null>(null);

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
        <h1>RNA-seq tracks</h1>
        <div className="controls">
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
