# BAM

`bamModule` draws sequence alignments straight from a BAM file and its BAI index. Coverage, read
pileup, and sashimi junction arcs are all derived from the alignments in view, so the track needs no
precomputed signal or junction files.

```ts
import { bamModule } from "@weng-lab/genomebrowser-tracks/bam";

bamModule.create({
  base: { id: "rna", title: "RNA-seq", display: "sashimi", height: 180 },
  config: { url: "YOUR_URL_HERE" },
});
```

## Displays

| Display    | Draws                                           |
| ---------- | ----------------------------------------------- |
| `coverage` | Per-base depth, filling the track. The default. |
| `pileup`   | Coverage above IGV-style stacked reads.         |
| `sashimi`  | Coverage above splice-junction arcs.            |

Coverage is binned to pixel columns with the same shared condenser the BigWig track uses, so the two
read alike at a glance. Depth counts `M`, `=`, and `X` operations; `N` and `D` advance the reference
without adding depth, so an intron reads as a gap rather than as coverage.

## Configuration

| Option               | Default        | Meaning                                                         |
| -------------------- | -------------- | --------------------------------------------------------------- |
| `url`                | required       | BAM file URL.                                                   |
| `indexUrl`           | `url` + `.bai` | BAI index URL.                                                  |
| `maxBases`           | `25000`        | Widest render window that will be fetched.                      |
| `minMappingQuality`  | `0`            | Drops alignments below this MAPQ. `0` keeps multi-mapped reads. |
| `maxReads`           | `400`          | Cap on reads drawn in a pileup.                                 |
| `minJunctionReads`   | `1`            | Hides junctions with fewer supporting reads.                    |
| `maxJunctionSpan`    | unset          | Hides junctions wider than this.                                |
| `coverageColor`      | `#3a6ea5`      | Coverage fill.                                                  |
| `reverseStrandColor` | `#d08b5b`      | Reverse-strand reads. Forward-strand reads use the base color.  |

Changing `url`, `indexUrl`, `maxBases`, or `minMappingQuality` refetches. The rest re-render what is
already loaded.

## The zoom gate

Everything this track draws comes from holding every alignment in the window in memory, so
`maxBases` exists to bound that, not to control what is drawn. Past it the fetcher returns nothing
and the track says so.

It measures the **render window**, which the browser overscans to three times the visible span so
panning stays smooth. A `maxBases` of 25,000 therefore starts drawing at a visible width near 8,300
bases. Raise it for shallow coverage; lower it for a deeply covered locus, where a wide view can
otherwise pull tens of thousands of records.

## Junction counts are window-local

Sashimi arcs are tallied from the `N` operations of the reads currently fetched. Only reads inside
the window contribute, so a count changes as you pan, and it is not a genome-wide total. The arcs
also carry no annotated-versus-novel flag, no unique-versus-multi split, and no splice-site motif:
those come from a splice-aware aligner's own output, not from the alignments alone. Use a
precomputed junction file through the [BigBed](bigbed.md) track when you need those.

Arc height scales with span, so a long-range junction rises above a short one. A dense view holds
more junctions than legible numbers, so counts are labelled highest-first and any label that would
overlap one already placed is omitted. The arc is still drawn, and its tooltip still reports the
count.

`maxJunctionSpan` is the useful filter at paralogous loci, where multi-mapped reads produce
long-range junctions that render as flat streaks across the view.

## Interactions and tooltips

Hovering or clicking gives an item tagged with what was hit, because a BAM track draws two different
things:

```ts
type BamInteractionTarget =
  { kind: "alignment"; alignment: BamRecord } | { kind: "junction"; junction: BamJunction };
```

## Exported helpers

`computeCoverageRuns(records, region)` and `computeJunctions(records)` are exported for callers that
want the same depths and junction tallies the track draws, without rendering it.

## Source requirements

The BAM and its index must both be reachable, support HTTP range requests, and send permissive CORS
headers when cross-origin. Reference names are matched exactly, so a file whose header says `1` will
not answer a query for `chr1` and the track renders empty. See
[Data source troubleshooting](../dataSources.md).
