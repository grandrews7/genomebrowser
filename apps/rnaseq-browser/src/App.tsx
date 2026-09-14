import {
  GenomeBrowser,
  createBrowserStore,
  createTrackStore,
  parseRegion,
  type AnyTrackInstance,
  type GenomicRegion,
} from "@weng-lab/genomebrowser";
import { bigWigModule } from "@weng-lab/genomebrowser-tracks/bigwig";
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
  GENE_TRACK_VARIANT,
  HIGHLIGHT_COLOR,
  HIGHLIGHT_GENE,
  INITIAL_REGION,
  SHOW_GENE_TRACK,
  SIGNAL_TRACKS,
  TWO_BIT_URL,
} from "./config";
import { bamModule } from "./tracks/bamModule";
import { dynseqModule } from "./tracks/dynseqModule";

const MARGIN_WIDTH = 150;

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

const geneDataset = getGeneDatasetsForAssembly(ASSEMBLY.id).find(
  (dataset) => dataset.release === GENCODE_RELEASE && dataset.variant === GENE_TRACK_VARIANT,
);
if (SHOW_GENE_TRACK && !geneDataset) {
  throw new Error(
    `No GENCODE ${GENCODE_RELEASE} ${GENE_TRACK_VARIANT} dataset for ${ASSEMBLY.id}. ` +
      `Available: ${getGeneDatasetsForAssembly(ASSEMBLY.id).map(getGeneDatasetTitle).join(", ")}.`,
  );
}

const geneTracks: AnyTrackInstance[] =
  SHOW_GENE_TRACK && geneDataset
    ? [
        geneModule.create({
          base: {
            id: "genes",
            title: getGeneDatasetTitle(geneDataset),
            display: GENE_TRACK_DISPLAY,
            height: GENE_TRACK_HEIGHT,
          },
          source: "host",
          config: {
            url: geneDataset.url,
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
      url: track.url,
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
      display: "full",
      height: track.height ?? 180,
    },
    config: {
      bamUrl: track.bamUrl,
      ...(track.baiUrl ? { baiUrl: track.baiUrl } : {}),
      ...(track.display ? { display: track.display } : {}),
      ...(track.coverageMaxBases ? { coverageMaxBases: track.coverageMaxBases } : {}),
      ...(track.maxBases ? { maxBases: track.maxBases } : {}),
      ...(track.sashimiMaxBases ? { sashimiMaxBases: track.sashimiMaxBases } : {}),
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
      bigwigUrl: track.bigwigUrl,
      twoBitUrl: track.twoBitUrl ?? TWO_BIT_URL,
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
