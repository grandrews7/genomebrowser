import { fetchOnChange } from "@weng-lab/genomebrowser";
import { z } from "zod";
import { hexColorSchema } from "../shared/schemas";

export const configSchema = z.object({
  url: fetchOnChange(z.string().min(1)),
  /** Defaults to `url` with `.bai` appended. */
  indexUrl: fetchOnChange(z.string().optional()),
  /**
   * Widest render window, in bases, that will be fetched. Coverage, pileup, and
   * arcs are all derived from every alignment in the window, so this bounds how
   * many records the page holds at once rather than how much is drawn. It
   * measures the overscanned render window, which is wider than the viewport.
   */
  maxBases: fetchOnChange(z.number().int().positive().default(25000)),
  /** Drops alignments below this mapping quality. 0 keeps multi-mapped reads. */
  minMappingQuality: fetchOnChange(z.number().int().min(0).default(0)),
  /** Upper bound on reads drawn in a pileup; the rest are evenly sampled out. */
  maxReads: z.number().int().positive().default(400),
  /** Hides junctions supported by fewer reads than this. */
  minJunctionReads: z.number().int().min(1).default(1),
  /**
   * Hides junctions wider than this. Paralogous loci produce long-range
   * junctions from multi-mapped reads; capping the span removes them.
   */
  maxJunctionSpan: z.number().int().positive().optional(),
  coverageColor: hexColorSchema.default("#3a6ea5"),
  /** Reverse-strand reads; forward-strand reads use the track's base color. */
  reverseStrandColor: hexColorSchema.default("#d08b5b"),
});
