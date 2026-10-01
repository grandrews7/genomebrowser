/**
 * ============================================================
 *  THIS IS THE ONLY FILE YOU NEED TO EDIT.
 * ============================================================
 *
 * Every dataset the browser offers, in the order the picker shows them. Each
 * one lives in ./datasets and owns its starting region, gene-track settings,
 * and track lists, so adding a view is one file plus one line here.
 *
 * `Dataset` in ./datasets/types.ts is the contract each file has to satisfy, so
 * a missing member is a compile error rather than an empty track.
 *
 * Every option must share one assembly. The browser store binds its assembly at
 * creation and normalises regions against it, so a second assembly would need a
 * second store; `App.tsx` checks on load and throws naming the offenders rather
 * than rendering coordinates that mean nothing. Switching datasets deliberately
 * keeps the region you are looking at, which is the point - the same locus
 * under a different set of evidence.
 */
import { dataset as arabidopsis } from "./datasets/arabidopsis";
import { dataset as arabidopsisMotifs } from "./datasets/arabidopsis-motifs";
import type { DatasetOption } from "./datasets/types";

export const DATASETS: DatasetOption[] = [
  {
    id: "assays",
    label: "Assay panel",
    dataset: arabidopsis,
  },
  {
    id: "motifs",
    label: "Attributions and motifs",
    dataset: arabidopsisMotifs,
  },
];

/** Which one the browser opens on. Must match an `id` above. */
export const DEFAULT_DATASET_ID = "motifs";
