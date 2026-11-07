import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** Opens a dropdown (Select) and picks the option with this name, as a user would. */
export async function pick(trigger: HTMLElement, option: string | RegExp): Promise<void> {
  await userEvent.click(trigger);
  await userEvent.click(await screen.findByRole('option', { name: option }));
}
