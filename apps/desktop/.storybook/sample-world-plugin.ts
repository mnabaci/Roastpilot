import { fileURLToPath } from 'node:url';
import { runnerImport, type Plugin } from 'vite';
import type { buildSampleWorld } from '../src/screenshots/sample-world';

const ID = 'virtual:sample-world';
const RESOLVED = `\0${ID}`;
const BUILDER = fileURLToPath(new URL('../src/screenshots/sample-world.ts', import.meta.url));

/**
 * `virtual:sample-world`: the sample world built in Node (it runs main's services and SQLite,
 * which a browser can't), inlined into the stories as JSON.
 */
export function sampleWorldPlugin(): Plugin {
  return {
    name: 'roastpilot-sample-world',
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load: async (id) => {
      if (id !== RESOLVED) return undefined;
      const { module } = await runnerImport<{ buildSampleWorld: typeof buildSampleWorld }>(
        BUILDER,
        { configFile: false },
      );
      return `export default ${JSON.stringify(await module.buildSampleWorld())};`;
    },
  };
}
