/**
 * ============================================================
 *  THIS IS THE ONLY FILE YOU NEED TO EDIT.
 * ============================================================
 *
 * Pick the dataset to show. Each one lives in ./datasets and owns its assembly,
 * starting region, gene-track settings, and track lists, so switching between
 * them is the single line below and nothing else.
 *
 * To add a dataset, copy ./datasets/hepg2.ts, point it at your files, and name
 * it here. `Dataset` in ./datasets/types.ts is the contract each file has to
 * satisfy, so a missing member is a compile error rather than an empty track.
 */
export * from "./datasets/hepg2";
