import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * Resolve the workspace packages to their TypeScript sources, the same way
 * `apps/playground` does, so editing a package is picked up by the dev server
 * without a package build first. Subpath entries MUST precede their package
 * root: Vite's string aliases match on a `pkg/` prefix, so a root entry listed
 * first would rewrite `@weng-lab/genomebrowser-tracks/gene` into
 * `.../src/lib.ts/gene`.
 */
const workspaceAliases = [
  {
    find: "@weng-lab/genomebrowser-tracks/bam",
    replacement: source("../../packages/tracks/src/bam/index.ts"),
  },
  {
    find: "@weng-lab/genomebrowser-tracks/dynseq",
    replacement: source("../../packages/tracks/src/dynseq/index.ts"),
  },
  {
    find: "@weng-lab/genomebrowser-tracks/bigwig",
    replacement: source("../../packages/tracks/src/bigwig/index.ts"),
  },
  {
    find: "@weng-lab/genomebrowser-tracks/gene",
    replacement: source("../../packages/tracks/src/gene/index.ts"),
  },
  {
    find: "@weng-lab/genomebrowser-tracks/shared",
    replacement: source("../../packages/tracks/src/shared/index.ts"),
  },
  {
    find: "@weng-lab/genomebrowser-tracks",
    replacement: source("../../packages/tracks/src/lib.ts"),
  },
  {
    find: "@weng-lab/genomebrowser",
    replacement: source("../../packages/core/src/lib.ts"),
  },
  {
    find: "@weng-lab/genomic-reader",
    replacement: source("../../packages/reader/src/lib.ts"),
  },
];

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: workspaceAliases,
    // The aliased package sources resolve React from their own node_modules.
    // Without deduping, hooks called inside a track module would run against a
    // second React copy and throw "Invalid hook call".
    dedupe: ["react", "react-dom", "@emotion/react", "@emotion/styled", "@mui/material"],
  },
});
