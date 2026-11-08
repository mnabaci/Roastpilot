import type { Preview } from '@storybook/react-vite';
// The app's own styles, as the renderer loads them.
import '../src/renderer/src/styles.css';

const preview: Preview = {
  parameters: {
    // The app fills the window, as in Electron.
    layout: 'fullscreen',
    backgrounds: { disable: true },
  },
};

export default preview;
