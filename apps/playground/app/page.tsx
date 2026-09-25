"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { createBrowserStore, createTrackStore, GenomeBrowser, hg38 } from "@weng-lab/genomebrowser";
import {
  geneModule,
  getGeneDatasetsForAssembly,
  getGeneDatasetTitle,
} from "@weng-lab/genomebrowser-tracks/gene";
import { bamModule } from "@weng-lab/genomebrowser-tracks/bam";
import { NavigationButton } from "@weng-lab/genomebrowser-ui";
import { useEffect, useRef } from "react";

const dataset = getGeneDatasetsForAssembly(hg38.id).find(
  (candidate) => candidate.version === 40 && candidate.variant === "comprehensive",
);
if (!dataset)
  throw new Error("The hg38 GENCODE 40 comprehensive dataset is missing from the catalog.");

const useBrowserStore = createBrowserStore({
  assembly: hg38,
  region: { chromosome: "chr12", start: 53379900, end: 53382600 },
  marginWidth: 180,
  trackWidth: 1000,
});
const useTrackStore = createTrackStore({
  modules: [geneModule, bamModule],
  tracks: [
    geneModule.create({
      base: {
        id: dataset.id,
        title: getGeneDatasetTitle(dataset),
        display: "merged",
      },
      source: "host",
      config: { url: dataset.url },
    }),
    bamModule.create({
      base: {
        id: "k562-coverage",
        title: "K562 long-read RNA-seq · coverage",
        display: "coverage",
        height: 70,
      },
      source: "user",
      config: {
        sequenceUrl: "https://users.wenglab.org/niship/hg38.2bit",
        url: "https://users.wenglab.org/niship/ENCSR526TQU.ENCFF322UJU.K562.bam",
        indexUrl: "https://users.wenglab.org/niship/ENCSR526TQU.ENCFF322UJU.K562.bam.bai",
      },
    }),
    bamModule.create({
      base: {
        id: "k562-sashimi",
        title: "K562 long-read RNA-seq · sashimi",
        display: "sashimi",
        height: 130,
      },
      source: "user",
      config: {
        sequenceUrl: "https://users.wenglab.org/niship/hg38.2bit",
        url: "https://users.wenglab.org/niship/ENCSR526TQU.ENCFF322UJU.K562.bam",
        indexUrl: "https://users.wenglab.org/niship/ENCSR526TQU.ENCFF322UJU.K562.bam.bai",
      },
    }),
    bamModule.create({
      base: {
        id: "k562-pack",
        title: "K562 long-read RNA-seq · pack",
        display: "pack",
        height: 14,
      },
      source: "user",
      config: {
        sequenceUrl: "https://users.wenglab.org/niship/hg38.2bit",
        url: "https://users.wenglab.org/niship/ENCSR526TQU.ENCFF322UJU.K562.bam",
        indexUrl: "https://users.wenglab.org/niship/ENCSR526TQU.ENCFF322UJU.K562.bam.bai",
      },
    }),
  ],
});

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const region = useBrowserStore((state) => state.region);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const { marginWidth, setTrackWidth } = useBrowserStore.getState();
      setTrackWidth(Math.max(1, entry.contentRect.width - marginWidth));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <main>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ flexWrap: "wrap", alignItems: "center", mb: 2 }}
      >
        <Typography component="h1" variant="h6" sx={{ m: 0 }}>
          hg38 · GENCODE 40 comprehensive + BAM
        </Typography>
        <NavigationButton
          browserStore={useBrowserStore}
          action={{ type: "zoom", factor: 0.5 }}
          size="small"
        >
          Zoom in
        </NavigationButton>
        <NavigationButton
          browserStore={useBrowserStore}
          action={{ type: "zoom", factor: 2 }}
          size="small"
        >
          Zoom out
        </NavigationButton>
        <Typography variant="body2" color="text.secondary">
          {region.chromosome}:{region.start.toLocaleString("en-US")}–
          {region.end.toLocaleString("en-US")}
        </Typography>
      </Stack>
      <Box ref={containerRef} sx={{ width: "100%", overflowX: "auto" }}>
        <GenomeBrowser browserStore={useBrowserStore} trackStore={useTrackStore} />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        K562 long-read RNA-seq over SP1, drawn three ways from one BAM. Coverage is per-base depth
        from aligned blocks only, so introns read as uncovered. Sashimi adds one arc per splice
        junction, labelled with the reads supporting it. Pack draws the alignments themselves; use
        BAM track settings to switch between dense, squish, pack, and full.
      </Typography>
    </main>
  );
}
