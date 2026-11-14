import { ok } from '@roastpilot/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { fakeApi } from '../../test/render-app';
import { POPPER, SKYWALKER } from '../../test/roasters';

export const roasters = [{ ...SKYWALKER, active: false }, POPPER];
export const card = () => within(screen.getByRole('region', { name: 'Wiring' }));
/** The card is folded once the roaster has a port, as POPPER has. */
export const openWiring = () => userEvent.click(screen.getByRole('button', { name: 'Wiring' }));

/** A board that reads TC1–TC4 and saves what is picked. */
export function withInputs() {
  return fakeApi({
    readRoasterInputs: vi.fn(() => Promise.resolve(ok([212.4, 165.2, 21.9, 22.1]))),
    saveRoasterWiring: vi.fn((request) => Promise.resolve(ok({ ...POPPER, ...request }))),
  });
}
