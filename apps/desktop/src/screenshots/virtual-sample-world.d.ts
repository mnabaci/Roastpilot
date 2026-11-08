// The sample world, built in Node by `.storybook/sample-world-plugin.ts` and inlined into the
// Storybook bundle as JSON: a `SampleWorld` (an ambient module can't import it by relative path).
declare module 'virtual:sample-world' {
  const world: unknown;
  export default world;
}
