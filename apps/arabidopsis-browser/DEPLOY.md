# Deploying

The app is a static Vite build hosted on Firebase Hosting. The genomic data it
reads lives in a public Google Cloud Storage bucket and is **not** part of the
build - keep it that way. Putting data files under `public/` copies them into
`dist`, which is what once made the bundle 197 MB rather than the 800 KB it is.

Everything lives in one project, `living-models-browser`, on the Living Models
billing account.

## Deploy

```sh
pnpm --filter @living-models/arabidopsis-browser build
cd apps/arabidopsis-browser && firebase deploy --only hosting
```

Live at <https://living-models-browser.web.app>.

`firebase.json` rewrites every path to `index.html` so the single page handles
any URL, and sets the caching split that matters:

- `/assets/**` is immutable for a year. Safe, because Vite fingerprints those
  filenames with their contents.
- `index.html` is `no-cache`. **This is not optional.** Firebase defaults HTML
  to `max-age=3600`, so without it a deploy takes up to an hour to reach anyone
  who has already loaded the page, and they see the previous build with nothing
  to indicate it is stale.

If someone reports stale content, have them open `?v=2` (any query value) -
a different URL bypasses their cache - and confirm what the server is really
sending:

```sh
curl -sI https://living-models-browser.web.app | grep -i cache-control
```

## The data

```
gs://living-models-browser-data/arabidopsis/
```

The bucket is public with CORS allowing any origin, so the deployed app reads it
straight from the browser. Nothing else is served from the bucket; the app is
Firebase's job alone.

Every object is served `Cache-Control: public, max-age=31536000, immutable`, so
a browser re-reads a file it has already seen without touching the network.
That matters more than it sounds: releasing a track releases the reader's own
cache, so revisiting a dataset reissues every range request, and the HTTP cache
is what makes those free. Measured across a dataset switch, 249 requests
returned 0 bytes from the network.

**A file is therefore cached for a year, and replacing one in place will not
reach anyone who has already loaded it.** Publish changed data under a new
name and point the dataset at it, rather than overwriting. To reset the header
on everything:

```sh
gcloud storage objects update "gs://living-models-browser-data/**" \
  --cache-control="public, max-age=31536000, immutable"
```

Three things matter when adding files:

- **Upload without transfer encoding.** `Content-Encoding: gzip` breaks the HTTP
  range requests that bigWig, bigBed and BAM all depend on, and these formats
  are already compressed internally. Check with
  `curl -I ... | grep stored-content-encoding` that it says `identity`.
- **Chromosome names must match the assembly exactly.** TAIR10 files here use
  `Chr1`..`Chr5`, `ChrM`, `ChrC`. A file naming the same sequences differently
  renders an empty track rather than an error, which is the least obvious way
  this goes wrong. Three conventions are in play across the source data: TAIR
  (`Chr1`), Ensembl Plants (`1`), and RefSeq (`NC_003070.9`).

```sh
gcloud storage cp yourfile.bw gs://living-models-browser-data/arabidopsis/
```

### Building the phyloP track and the 2bit

PlantRegMap publishes conservation as `Ath_PhyloP.bedGraph.gz`, per base over an
18-species Brassicales alignment, already using TAIR contig names - no renaming
needed, unlike everything else here.

```sh
gzcat Ath_PhyloP.bedGraph.gz > Ath_PhyloP.bedGraph          # 4.0 GB, 106.8M lines
./bedGraphToBigWig Ath_PhyloP.bedGraph tair10.full.chrom.sizes Ath_PhyloP.bw
```

`tair10.full.chrom.sizes` must include `ChrC` and `ChrM`, which the bedGraph
covers. Conversion takes about half a minute and yields 856 MB.

dynseq also needs a 2bit for its letters. The pipeline's `tair10.fa` uses RefSeq
names, so rewrite the headers first:

```sh
gcloud storage cat gs://greg-data/atac/resources/tair10/tair10.fa \
  --project=dotomics-models \
| awk 'BEGIN{ m["NC_003070.9"]="Chr1"; m["NC_003071.7"]="Chr2"; m["NC_003074.8"]="Chr3";
              m["NC_003075.7"]="Chr4"; m["NC_003076.8"]="Chr5"; m["NC_000932.1"]="ChrC" }
  /^>/ { id=substr($1,2); keep=(id in m); if(keep) print ">" m[id]; next }
  keep { print }' > tair10.Chr.fa
./faToTwoBit tair10.Chr.fa tair10.2bit
```

The mitochondrion is deliberately excluded. RefSeq's `NC_037304.1` is 367,808 bp
against TAIR10's `ChrM` at 366,924 - a different sequence, not a renaming - so
including it would misalign letters against any ChrM score. The five nuclear
chromosomes and `ChrC` match exactly.

### Renaming contigs in a bigWig

Pipeline bigWigs label TAIR10 contigs with RefSeq accessions - `NC_003070.9`
through `NC_003076.8` - rather than `Chr1`..`Chr5`. Same sequences, same
lengths, different names, so they render an empty track against this assembly.
Confirm the lengths match `tair10` before renaming anything; if they do, the
rename is a relabel and no coordinate moves.

**Do not round-trip through bedGraph.** `bigWigToBedGraph` prints about six
significant digits, so every float is silently rounded - 5.0e-06 relative on
this project's attribution tracks - and `bedGraphToBigWig` stores an explicit
start and end per item, which inflates per-base data by about two thirds. The
old recipe here did exactly that, and its "lossless" claim rested on converting
the _rebuilt_ file back to bedGraph, a test that only exercises the second leg
and cannot see the rounding the first leg already did.

Go through a fixedStep wig instead. `%.9g` uniquely determines a float32, and a
contiguous run of per-base values stores no coordinates at all, so the result is
bit-exact _and_ smaller than the source:

```python
# rename_fixedstep.py - needs pyBigWig (HiPerGator: module load deeptools/3.5.2)
import sys, pyBigWig
MAP = {"NC_003070.9":"Chr1","NC_003071.7":"Chr2","NC_003074.8":"Chr3",
       "NC_003075.7":"Chr4","NC_003076.8":"Chr5"}
src = pyBigWig.open(sys.argv[1]); out = open(sys.argv[2], "w", buffering=1<<22)
for c in [c for c in src.chroms() if c in MAP]:
    new, n = MAP[c], src.chroms()[c]
    run_start = run_next = None; vals = []
    def flush():
        global run_start, run_next, vals
        if vals:
            out.write(f"fixedStep chrom={new} start={run_start+1} step=1 span=1\n")
            out.write("".join(vals))
        run_start = run_next = None; vals = []
    for s in range(0, n, 5_000_000):
        for st, en, v in src.intervals(c, s, min(s+5_000_000, n)) or ():
            if st < s: continue          # already emitted by the previous chunk
            if run_next is not None and st != run_next: flush()
            if run_start is None: run_start, run_next = st, st
            vals.extend([f"{v:.9g}\n"] * (en - st))
            run_next = en
    flush()
out.close()
```

```sh
python rename_fixedstep.py in.bw out.wig
wigToBigWig out.wig tair10.chrom.sizes out.bw
```

`tair10.chrom.sizes` is the five nuclear chromosomes under TAIR names. The map
drops any contig not in it, so organelles present in one file and absent from
the sizes file cannot fail the rebuild.

Verify rather than assume - compare per base, not per bedGraph row, because
rounding merges adjacent equal values and leaves the two files with different
run counts, which makes a naive `paste` comparison report nonsense:

```python
import numpy as np, pyBigWig
a, b = pyBigWig.open("in.bw"), pyBigWig.open("out.bw")
for s, d in MAP.items():
    n = a.chroms()[s]
    for x in range(0, n, 10_000_000):
        y = min(x + 10_000_000, n)
        va = np.array(a.values(s, x, y)); vb = np.array(b.values(d, x, y))
        assert (np.isnan(va) == np.isnan(vb)).all()          # same covered bases
        k = ~np.isnan(va); assert (va[k] == vb[k]).all()     # same values
```

On HiPerGator the UCSC binaries are at `/apps/ucsc/20210803` - flat in that
directory, and `module load ucsc/20210803` does **not** put them on `PATH`.
One 350 MB track takes about 70 s, so a 16-file library is a SLURM array job
rather than login-node work.

The fifteen ATAC bigWigs already in the bucket predate this and went through the
bedGraph path, so they carry that 5e-06 rounding. Harmless for viewing coverage;
rebuild them before doing arithmetic on the values.

### Renaming contigs in a BED

Column 1 only, then sort and convert. Keep extra columns typed by writing an
AutoSql file, or they arrive as untyped strings:

```sh
awk 'BEGIN{FS=OFS="\t"
  m["NC_003070.9"]="Chr1"; m["NC_003071.7"]="Chr2"; m["NC_003074.8"]="Chr3"
  m["NC_003075.7"]="Chr4"; m["NC_003076.8"]="Chr5" }
  ($1 in m){ $1=m[$1]; print }' in.bed | sort -k1,1 -k2,2n > renamed.bed
bedToBigBed -type=bed6+3 -as=schema.as -tab renamed.bed tair10.chrom.sizes out.bb
```

Check it by converting back and mapping the names to accessions: the result
should be byte-identical to the sorted source.

Note that the bigBed track module has **no field filter**. A threshold on a
score column has to be baked into the file, which is why the motif data below
ships both full and pre-filtered variants.

### Renaming contigs in an RNA-seq BAM

The STAR output for SRX4488631 carries the same RefSeq accessions, and a BAM
header can be rewritten in place rather than rebuilt: `reheader` touches only the
header block, so a 1.1 GB file takes under two seconds. The index must be
regenerated afterwards, because changing the header length shifts every virtual
offset the old `.bai` recorded.

```sh
samtools reheader -c "sed \
  -e s/SN:NC_003070.9/SN:Chr1/ -e s/SN:NC_003071.7/SN:Chr2/ \
  -e s/SN:NC_003074.8/SN:Chr3/ -e s/SN:NC_003075.7/SN:Chr4/ \
  -e s/SN:NC_003076.8/SN:Chr5/ -e s/SN:NC_000932.1/SN:ChrC/" \
  Aligned.sortedByCoord.out.bam > SRX4488631.bam
samtools index -@ 4 SRX4488631.bam
```

`NC_037304.1` is deliberately not renamed. RefSeq's mitochondrion is 367,808 bp
and TAIR10's `ChrM` is 366,924, so they are different assemblies of the same
organelle; calling it `ChrM` would give a contig whose coordinates line up with
nothing else here. Left under its accession it is simply absent from the
assembly and unreachable, which is the honest outcome. Every other contig
matched TAIR10 lengths exactly, so those renames are safe.

The stranded bigWigs need the full bedGraph round trip as above, with `ChrC`
added to the map and `NC_037304.1` dropped.

### Uploading from the cluster

The BAM is 1.1 GB and a home upstream will not move that in reasonable time.
HiPerGator has `gcloud` under `/blue/jhernandezjarqui/andrewsg/pixi/bin` already
authenticated, so upload from there instead and skip the round trip through a
laptop: it sustains about 400 MiB/s.

Turn off parallel composite upload first. It splits the object into parts and
recombines them server-side, which leaves the result without an MD5 and is worth
avoiding for files served by range request:

```sh
gcloud config set storage/parallel_composite_upload_enabled False
```

All fifteen TAIR10 samples are converted and uploaded. After adding more, check
the two things that fail silently rather than erroring:

```sh
curl -sI -H "Range: bytes=0-63" \
  https://storage.googleapis.com/living-models-browser-data/arabidopsis/atac-SRX.bw \
  | grep -iE "^HTTP/|stored-content-encoding"
```

expecting `206` and `identity`, and confirm the contig names in the served bytes
are `Chr1`..`Chr5` rather than RefSeq accessions.

### The motif-discovery data

`gs://living-models-browser-data/arabidopsis/motif-discovery/` holds gradient
attributions and discovered motifs for the BOTANIC fine-tuned ATAC model,
rendered by `src/datasets/arabidopsis-motifs.ts`. Source and full method are in
`PROVENANCE.txt` beside the data, and in the README of the pipeline output at
`/blue/jhernandezjarqui/gary.klajer/motif_discovery/bigwig/` on HiPerGator.

| File                                            | Contents                                                |
| ----------------------------------------------- | ------------------------------------------------------- |
| `grad_{count,profile,combined}_contrib.bw`      | attribution at the reference base - the dynseq tracks   |
| `grad_*_hyp_{A,C,G,T}.bw`                       | per-base values for all four bases, for logos           |
| `coverage.bw`                                   | scored windows covering each base                       |
| `finemo_{count,combined}_hits.bb`               | FiNeMo hits, all of them                                |
| `finemo_{count,combined}_hits_sim0.9.bb`        | the same filtered to `hit_similarity >= 0.9`            |
| `modisco_{count,profile,combined}_seqlets.bb`   | TF-MoDISco seqlets                                      |
| `windows.bb`                                    | the scored windows, named `split:peaks\|background:row` |
| `discovered_patterns.meme`                      | every pattern with its family label                     |
| `cbp_pred_nobias.bw`                            | ChromBPNet predicted signal, bias-corrected             |
| `cbp_{counts,profile}_contrib.bw`               | ChromBPNet DeepSHAP attribution, bias-corrected         |
| `botanic1s_atac_{predicted,observed}_signal.bw` | BOTANIC predicted and observed ATAC signal              |
| `botanic1s_atac_window_counts.bb`               | per-window predicted vs observed log1p counts           |

Three things about this data are easy to get wrong:

- **It is sparse by construction.** Only the central 1 kb of each window is
  scored, so bases outside every window carry no value. An empty stretch in an
  attribution track is usually that, not a broken file - `coverage.bw` tells
  the two apart, which is why it is worth keeping on screen.
- **Filter the FiNeMo hits.** Unfiltered, only 20% of G-box-family hits sit on
  an actual CACGTG; at `hit_similarity >= 0.9` that is 96%, keeping 18% of the
  hits. The module cannot filter, so the threshold is baked into the `sim0.9`
  files and the dataset points at those.
- **Only the count track's sign means "more or fewer reads".** `profile` and
  `combined` describe redistribution within the window, so their signs say
  where signal moves, not whether there is more of it.

The `botanic1s_*` files arrived already TAIR-named from
`/blue/jhernandezjarqui/gary.klajer/browser_export/` and needed no conversion -
contig names and lengths were checked against the assembly rather than taken on
trust, and `basesCovered` matches the other BOTANIC files exactly, so they cover
the same 88,249 windows. Two independent checks were run before uploading:
`log1p` of the summed per-base signal reproduces the bigBed's `pred_count` and
`obs_count` to 5e-06 across 60 non-overlapping windows, and the test-split
correlations recompute to 0.750 on peaks and 0.657 on background, matching the
README.

Note there are now **two observed ATAC tracks** and they are not the same file.
Both are +4/-4 shifted 5' cut sites of the same library over the same positions
with no offset between them; what differs is **PCR duplicate removal**. The
ChromBPNet track comes from the BAM after `sambamba markdup -r`, the BOTANIC one
from a BAM where duplicates were never marked - its `@PG` chain filters with
`-F 1804`, which drops reads already flagged 1024, but nothing upstream ever
flagged any.

The arithmetic closes: `results/picard/SRX8571616-tair10.txt` reports 80,197,636
reads in and 65,981,082 out (17.73% duplicates), and the two bigWigs total
80,197,634 and 65,981,082 cut sites. Peak pileup drops 5,290 to 811.

If you need to compare a BOTANIC prediction against a ChromBPNet one
quantitatively, this is the correction to apply first. BOTANIC's count head was
fit to totals inflated about 18%, unevenly, since duplicate rate rises with
local coverage.

Two smaller things fall out of the same comparison. The tracks come from
separate alignment runs - two reads apart in 80.2 million - leaving 98 singleton
positions covered by one and not the other, which is `bowtie2 -k 1 --threads 8`
choosing differently among equally scoring alignments and not worth chasing. And
comparing coverage by `nBasesCovered` alone would have shown a difference of
4 and hidden all 98, because the gains and losses nearly cancel; compare the
covered masks, not their totals.

The `cbp_*` files come from a different pipeline - ChromBPNet, at
`/blue/jhernandezjarqui/andrewsg/plant-atac/results/chrombpnet/SRX8571616-tair10/`

- on the same ATAC sample and the same 30,965 MACS3 peaks, so the two models'
  attributions are comparable region for region. Three things about them:

- **They carry organelles, unlike Gary's files.** `NC_000932.1` is ChrC at
  154,478 bp and matches TAIR10 exactly; `NC_037304.1` is 367,808 against
  TAIR10's `ChrM` at 366,924 and is dropped rather than renamed. Both turned out
  to have zero coverage here, so the rebuilt files are the five nuclear
  chromosomes - a converter that maps every contig and then verifies per contig
  has to treat "absent from the output" as correct when the source had nothing
  there, or it reports a failure that is really its own bug.
- **The observed track to read the prediction against** is
  `atac-SRX8571616.bw`, already in the bucket, which is the pipeline's
  `chrombpnet_signal/…_unstranded.bw` (+4/-4). Not
  `insertion_signal/…insertion.cpm.bigWig`, which is +4/-5 and CPM-normalised.
- **The archive copy on orange has no `contribs/`.** Only `preds`, `model`,
  `bias_model` and the nonpeak files are mirrored there; contributions exist on
  blue alone.

The twelve `hyp_*` files are uploaded but unused: `dynseqModule` takes a single
signal and draws the _reference_ base, so a stacked four-base logo needs a
module that accepts four bigWigs. That module is the only thing missing.

## Using these packages from another project

The BAM reader and the BAM and dynseq track modules are not in the published
`2.0.0` packages - they are open upstream as weng-lab/genomebrowser#263 and
\#264. This fork carries the same version number, so `npm install
@weng-lab/genomebrowser-tracks` resolves to upstream's build, which has no
`./bam` and no `./dynseq`, and nothing warns you.

Until those merge and a release ships, pack tarballs from this fork. `dist` is
gitignored and there is no `prepare` script, so installing straight from GitHub
gives a package with no build output; `pnpm pack` runs `prepack`, which builds
the whole chain:

```sh
mkdir -p ~/tarballs
for p in @weng-lab/genomebrowser @weng-lab/genomebrowser-tracks @weng-lab/genomic-reader; do
  pnpm --filter "$p" pack --pack-destination ~/tarballs
done
```

Reference them by path in the other project:

```json
"@weng-lab/genomebrowser": "file:../tarballs/weng-lab-genomebrowser-2.0.0.tgz",
"@weng-lab/genomebrowser-tracks": "file:../tarballs/weng-lab-genomebrowser-tracks-2.0.0.tgz",
"@weng-lab/genomic-reader": "file:../tarballs/weng-lab-genomic-reader-2.0.0.tgz"
```

Then import normally - `bamModule` from `@weng-lab/genomebrowser-tracks/bam`,
`createBamFile` from `@weng-lab/genomic-reader`. The Vite aliases and tsconfig
path mappings this repo uses are only needed inside the workspace, where the
packages resolve to TypeScript source rather than to `dist`.

Re-pack after changing a package, which suits consuming a stable snapshot rather
than co-developing. For a project inside this monorepo, add it under `apps/` and
depend on `workspace:*` instead.
