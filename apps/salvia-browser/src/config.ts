/**
 * ============================================================
 *  THIS IS THE ONLY FILE YOU NEED TO EDIT.
 * ============================================================
 *
 * Every dataset the browser offers, in the order the picker shows them. One
 * entry is fine; the picker hides itself when there is nothing to pick.
 *
 * Every option must share one assembly - the browser store binds its assembly
 * at creation. That is why Salvia is its own app rather than another entry in
 * the Arabidopsis one.
 */
import { dataset as salvia } from "./datasets/salvia";
import type { DatasetOption } from "./datasets/types";

export const DATASETS: DatasetOption[] = [
  {
    id: "salvia",
    label: "Salvia sclarea v3",
    dataset: salvia,
  },
];

/** Which one the browser opens on. Must match an `id` above. */
export const DEFAULT_DATASET_ID = "salvia";
