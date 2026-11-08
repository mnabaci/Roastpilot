import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';
import { sampleWorldPlugin } from './sample-world-plugin';

// The app's screens, whole, on sample data: the README screenshots (`pnpm screenshots`).
// Components have their own Storybook in packages/ui.
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  core: { disableTelemetry: true },
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [...(viteConfig.plugins ?? []), tailwindcss(), sampleWorldPlugin()],
  }),
};

export default config;
