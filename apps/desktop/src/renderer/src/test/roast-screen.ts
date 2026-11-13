import { AUTO_OFF, DEFAULT_SETTINGS, READY_ROAST, type Reading } from '@roastpilot/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BUILT_INS as profiles } from './profiles';
import { CONNECTED } from './render-app';

/** What the Roast screen tests share: a roast in a phase, readings, a connected roaster, Auto. */
export const roast = (phase: (typeof READY_ROAST)['phase']) => ({ ...READY_ROAST, phase });
export const reading = (values: Reading['values'], atMs = 1000): Reading => ({ atMs, values });
export const connected = { connection: CONNECTED };
export const onConnect = () => undefined;

/** The setup card starts closed; Change opens the rest of it. */
export const openSetup = () =>
  userEvent.click(
    within(screen.getByRole('region', { name: 'Setup' })).getByRole('button', {
      name: 'Change setup',
    }),
  );

/** A connected roaster in Auto mode, in a phase, with the built-in profiles and Auto switched on. */
export const autoSettings = { ...DEFAULT_SETTINGS, roastMode: 'auto' } as const;
export const auto = (phase: (typeof READY_ROAST)['phase'], status: object = {}) => ({
  ...connected,
  roast: roast(phase),
  settings: autoSettings,
  profiles,
  auto: { ...AUTO_OFF, enabled: true, ...status },
});
