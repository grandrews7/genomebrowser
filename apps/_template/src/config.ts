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
 *
 * One entry is fine; the picker hides itself when there is nothing to pick.
 */
import { dataset as example } from "./datasets/example";
import { dataset as exampleBasic } from "./datasets/example-basic";
import type { DatasetOption } from "./datasets/types";

export const DATASETS: DatasetOption[] = [
  {
    id: "comprehensive",
    label: "All transcripts",
    dataset: example,
  },
  {
    id: "basic",
    label: "Curated transcripts",
    dataset: exampleBasic,
  },
];

/** Which one the browser opens on. Must match an `id` above. */
export const DEFAULT_DATASET_ID = "comprehensive";
