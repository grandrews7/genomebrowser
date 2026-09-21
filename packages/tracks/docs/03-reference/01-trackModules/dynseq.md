# dynseq

`dynseqModule` draws per-base scores as a filled signal when zoomed out, and as reference
nucleotides scaled by their score when zoomed in, with negative scores below the axis. It suits
conservation tracks and model attribution signals, where which base carries the score is the point.

```ts
import { dynseqModule } from "@weng-lab/genomebrowser-tracks/dynseq";

dynseqModule.create({
  base: { id: "phylop", title: "phyloP", height: 100 },
  config: { url: "YOUR_URL_HERE", twoBitUrl: "YOUR_URL_HERE" },
});
```

## Two files

The score BigWig supplies the values and the 2bit supplies the letters. Both are read for the same
region, and the 2bit record starts exactly at the base it reports, so scores and letters line up by
coordinate with no offset correction. A score with no reference base to sit on is dropped rather
than shifted onto a neighbour.

Scores are read as BigWig **source values**, never as a zoom summary, because a reduced level has no
single value to place on an individual base. Reading a genome-wide file across a wide window
therefore returns one record per base; keep the track's window modest, or pair it with a plain
BigWig track for the zoomed-out view.

## Configuration

| Option             | Default  | Meaning                                                     |
| ------------------ | -------- | ----------------------------------------------------------- |
| `url`              | required | Per-base score BigWig.                                      |
| `twoBitUrl`        | required | Reference sequence supplying the letters.                   |
| `maxLetterBases`   | `500`    | Letters are drawn only when the visible window is narrower. |
| `minPixelsPerBase` | `3`      | Letters also need this much room per base.                  |

Changing either URL refetches; the two thresholds re-render what is already loaded.

`maxLetterBases` measures the **visible** window, not the overscanned render window the browser
fetches, so the number means what it says on screen.

## Scaling

Every score is scaled against the largest absolute value in the window, and the axis sits at the
track's vertical centre. A single extreme base therefore flattens the rest of the view, which is
expected for signals such as phyloP where most positions sit near zero and a conserved element
spikes. Zooming in rescales to the new window.

Soft-masked reference bases arrive lowercase and are upper-cased before the glyph is chosen, so a
repeat-masked region still draws letters.

## Glyphs

The nucleotide shapes are the weng-lab LogoJS geometry, emitted as plain SVG. `NUCLEOTIDE_GLYPHS`
and `NUCLEOTIDE_COLORS` are exported for callers that want to draw the same letters elsewhere.

## Source requirements

Both files must support HTTP range requests and send permissive CORS headers when cross-origin. See
[Data source troubleshooting](../dataSources.md).
