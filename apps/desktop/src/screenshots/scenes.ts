import type { Screen } from '@roastpilot/shared';
import { screen as page, waitFor } from '@testing-library/dom';
import { userEvent } from '@testing-library/user-event';
import type { SampleWorld } from './app-state';

/** One README screenshot: the moment, the screen, and what a person clicks to get there. */
export interface Scene {
  /** Also the file name: `docs/images/<id>.png`. */
  id: string;
  moment: keyof SampleWorld;
  screen: Screen;
  /** Clicks and types like a person, then waits until the scene shows what the README says. */
  prepare: () => Promise<void>;
}

/** A section scrolled to the middle of the window starts above this; unscrolled, below it. */
const SCROLLED_TOP_PX = 400;

const user = () => userEvent.setup({ delay: null });

/**
 * Leaves no caret or focus ring in the picture: once panels have closed and handed focus back,
 * nothing is focused.
 */
export async function dropFocus(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

/** The scenes in the README, in its order (README.md, Screenshots). */
export const SCENES: readonly Scene[] = [
  {
    id: 'roast-auto',
    moment: 'auto',
    screen: 'roast',
    prepare: async () => {
      await page.findByText(/vs ghost|vs plan/);
    },
  },
  {
    id: 'roast-manual',
    moment: 'manual',
    screen: 'roast',
    prepare: async () => {
      await page.findByText(/Coach suggests/);
    },
  },
  {
    id: 'profiles',
    moment: 'idle',
    screen: 'profiles',
    prepare: async () => {
      await user().click(await page.findByRole('button', { name: 'Light · Steps' }));
      await page.findByRole('heading', { level: 2, name: 'Light · Steps' });
    },
  },
  {
    id: 'history',
    moment: 'idle',
    screen: 'history',
    prepare: async () => {
      const clicks = user();
      await clicks.click(await page.findByRole('button', { name: 'Compare: None' }));
      // The oldest roast, the 5★ one: last in the list.
      const options = await page.findAllByRole('option');
      const oldest = options.at(-1);
      if (!oldest) throw new Error('No roast to compare with');
      await clicks.click(oldest);
      // The closing panel hands focus back to Compare, which scrolls it into view: first that.
      await dropFocus();
      // The two curves, as History is used to compare them; again until the page is tall enough.
      const curves = page.getByRole('region', { name: 'Roast curve' });
      await waitFor(() => {
        curves.scrollIntoView({ block: 'center' });
        if (curves.getBoundingClientRect().top > SCROLLED_TOP_PX) throw new Error('Not scrolled');
      });
    },
  },
  {
    id: 'beans',
    moment: 'idle',
    screen: 'beans',
    prepare: async () => {
      const keys = user();
      await keys.click(await page.findByRole('button', { name: /Ethiopia Guji/ }));
      await keys.click(await page.findByRole('button', { name: 'Add stock' }));
      await keys.type(await page.findByRole('textbox', { name: 'Weight' }), '2000');
      // The form starts on today; the picture keeps one date.
      const bought = page.getByRole('textbox', { name: 'Bought on' });
      await keys.clear(bought);
      await keys.type(bought, '2026-11-08');
    },
  },
  {
    id: 'roasters',
    moment: 'idle',
    screen: 'roasters',
    prepare: async () => {
      await page.findByRole('heading', { name: 'Simulator' });
    },
  },
];
