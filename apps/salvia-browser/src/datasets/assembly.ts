import { createAssemblyDefinition } from "@weng-lab/genomebrowser";

/**
 * Salvia sclarea v3, with organelles.
 *
 * Defined here rather than in `packages/core` because an assembly is a property
 * of the data an app shows, not of the browser. Keeping it in the app also
 * keeps `packages/` identical to upstream, so merging upstream stays a
 * fast-forward.
 *
 * Taken verbatim from the reference index,
 * `salvia_sclarea_v3_withOrg.fa.fai`, which is the only source that cannot
 * disagree with the FASTA the data was aligned against. The GTF the annotation
 * was built from and the coverage bigWigs use these same names, so nothing here
 * needs renaming - the usual cause of an empty track does not apply.
 */
export const salviaSclareaV3 = createAssemblyDefinition({
  id: "salviaSclareaV3",
  chromosomes: {
    Ss01: 71453059,
    Ss02: 61125452,
    Ss03: 60691999,
    Ss04: 55117540,
    Ss05: 53079460,
    Ss06: 51333777,
    Ss07: 45483023,
    Ss08: 42935093,
    Ss09: 42186297,
    Ss10: 29461910,
    Ss11: 29426146,
    Pt: 151268,
    Mt: 247370,
  },
});
