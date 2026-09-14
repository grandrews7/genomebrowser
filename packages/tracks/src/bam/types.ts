import type { BamRecord } from "@weng-lab/genomic-reader";
import type { z } from "zod";
import type { configSchema } from "./schema";

export type BamConfig = z.output<typeof configSchema>;
export type BamData = BamRecord[];
export type BamDisplay = "coverage" | "pileup" | "sashimi";

/** A splice junction tallied from the N operations of the reads in view. */
export type BamJunction = {
  start: number;
  end: number;
  /** Reads in the fetched window spanning this junction. */
  count: number;
};

/**
 * Hovering or clicking a BAM track can mean one of two things, so the item
 * carries which.
 */
export type BamInteractionTarget =
  | { kind: "alignment"; alignment: BamRecord }
  | { kind: "junction"; junction: BamJunction };
