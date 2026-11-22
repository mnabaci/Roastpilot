import type { Plugin } from 'vite';

/**
 * What the preload may load at runtime: `electron` alone. The sandbox allows a few built-ins as
 * well, but never a package, and the preload needs none of them: the rest is bundled into it.
 */
export const PRELOAD_MAY_LOAD: readonly string[] = ['electron'];

/** What a built preload chunk loads at runtime, as the bundle lists it. */
interface PreloadChunk {
  type: 'chunk' | 'asset';
  fileName: string;
  imports?: readonly string[];
  dynamicImports?: readonly string[];
}

/** The modules each chunk loads that a sandboxed preload can't: "index.cjs loads zod". */
export function preloadImportProblems(
  bundle: Readonly<Record<string, PreloadChunk>>,
  allowed: readonly string[] = PRELOAD_MAY_LOAD,
): string[] {
  return Object.values(bundle).flatMap((chunk) =>
    chunk.type !== 'chunk'
      ? []
      : [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]
          // Another chunk of the same preload is bundled code, not a package.
          .filter((id) => !id.startsWith('.') && !(id in bundle) && !allowed.includes(id))
          .map((id) => `${chunk.fileName} loads ${id}`),
  );
}

/**
 * Fails the preload build when it would load anything but `electron` at runtime. A sandboxed
 * preload can't load a package: one electron-vite leaves external (as zod once was) stops it, and
 * the window opens blank with every other check still green.
 */
export function preloadLoadsOnlyElectron(): Plugin {
  return {
    name: 'roastpilot:preload-loads-only-electron',
    generateBundle(_options, bundle) {
      const problems = preloadImportProblems(bundle);
      if (problems.length > 0)
        this.error(
          `The sandboxed preload may load only ${PRELOAD_MAY_LOAD.join(', ')}: ${problems.join('; ')}. ` +
            'Bundle it instead (preload.build.externalizeDeps.exclude in electron.vite.config.ts).',
        );
    },
  };
}
