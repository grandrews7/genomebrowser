import { Buffer } from "buffer";

/**
 * Define the Node `Buffer` global before anything touches a BAM.
 *
 * The legacy `genomic-reader` (see src/tracks/bamModule.tsx) has an
 * AxiosDataLoader that does `response.data instanceof Buffer`, which throws in
 * a browser. Setting the global eagerly here makes that check work no matter
 * how Vite resolves `buffer` later. Nothing else in the app needs it:
 * `@weng-lab/genomic-reader` reads bigWig/2bit with fetch and typed arrays.
 */
if (typeof (globalThis as { Buffer?: unknown }).Buffer === "undefined") {
  (globalThis as { Buffer?: unknown }).Buffer = Buffer;
}
