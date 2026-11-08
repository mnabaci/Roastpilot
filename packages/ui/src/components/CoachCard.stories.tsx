import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { CoachCard } from './CoachCard';
import type { CoachChange } from './CoachChanges';

const heater = (from: number, to: number): CoachChange => ({
  name: 'Heater',
  from,
  to,
  tone: 'heat',
});
const fan = (from: number, to: number): CoachChange => ({ name: 'Fan', from, to, tone: 'air' });

const meta: Meta<typeof CoachCard> = {
  title: 'Controls/CoachCard',
  component: CoachCard,
  decorators: [
    (Story) => (
      // The width of the Roast screen's side panel.
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CoachCard>;

/** A suggestion with its change, reason and actions. */
const suggestion = (
  changes: readonly CoachChange[],
  reason: string,
  note?: string,
  applying = false,
): Story => ({
  render: () => (
    <CoachCard
      changes={changes}
      reason={reason}
      {...(note ? { note } : {})}
      applying={applying}
      onApply={fn()}
      onDismiss={fn()}
    />
  ),
});

/** A heads-up: its line and Dismiss. */
const headsUp = (line: string, note?: string): Story => ({
  render: () => (
    <CoachCard variant="heads-up" line={line} {...(note ? { note } : {})} onDismiss={fn()} />
  ),
});

const CALIBRATE = 'needs calibration';

export const HeatSuggestion = suggestion([heater(65, 75)], '4 °C below target, RoR falling');
export const BothOutputs = suggestion(
  [heater(75, 65), fan(50, 65)],
  'Maillard from 165 °C',
  CALIBRATE,
);
export const StepPhase = suggestion([heater(70, 85)], 'RoR 6.5 · step wants 8–12');
export const NeedsCalibration = suggestion([heater(65, 75)], 'RoR stalling', CALIBRATE);
/** Apply was pressed and its call hasn't come back: it can't be pressed twice. */
export const Applying = suggestion([heater(65, 75)], '4 °C below target', undefined, true);
export const FirstCrackSoon = headsUp('First crack in ~45 s · listen');
export const DropSoon = headsUp('Drop in ~30 s · 1:45 development');
export const CapSoonNeedsCalibration = headsUp('BT cap 225 °C in ~30 s', CALIBRATE);
