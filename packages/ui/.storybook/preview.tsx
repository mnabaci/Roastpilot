import type { Preview } from '@storybook/react-vite';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import './preview.css';

const preview: Preview = {
  decorators: [
    // Same switch the app uses: <html data-theme="dark|light">.
    withThemeByDataAttribute({
      themes: { Dark: 'dark', Light: 'light' },
      defaultTheme: 'Dark',
      attributeName: 'data-theme',
    }),
  ],
  parameters: {
    layout: 'padded',
    backgrounds: { disable: true },
    // Accessibility violations fail story tests, not just warn.
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
};

export default preview;
