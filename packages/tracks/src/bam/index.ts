import type { ModuleCreateInput, ModuleInstance } from "@weng-lab/genomebrowser";
import { defineTrackModule } from "@weng-lab/genomebrowser";
import { fetchBam } from "./fetch";
import { CoverageBam, PileupBam, SashimiBam } from "./render";
import { configSchema } from "./schema";
import { BamSettings } from "./settings";
import { BamTooltip } from "./tooltip";
import type { BamInteractionTarget } from "./types";

/**
 * Sequence alignments read straight from a BAM, with no precomputed signal or
 * junction files. Coverage, read pileup, and sashimi arcs are all derived from
 * the alignments in view, which is why every display shares one zoom gate.
 */
export const bamModule = defineTrackModule<BamInteractionTarget>()({
  type: "bam",
  defaults: { height: 180, color: "#5b8bd0" },
  configSchema,
  fetch: fetchBam,
  render: { coverage: CoverageBam, pileup: PileupBam, sashimi: SashimiBam },
  settingsComponent: BamSettings,
  tooltipComponent: BamTooltip,
});

export type BamCreateInput = ModuleCreateInput<typeof bamModule>;
export type BamConfig = ModuleInstance<typeof bamModule>["config"];
export { computeCoverageRuns, computeJunctions } from "./helpers";
export type { BamData, BamDisplay, BamInteractionTarget, BamJunction } from "./types";
