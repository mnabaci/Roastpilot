import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { CoachCard } from './CoachCard';

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
const suggestion = (change: string, reason: string, note?: string): Story => ({
  render: () => (
    <CoachCard
      change={change}
      reason={reason}
      {...(note ? { note } : {})}
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

const CALIBRATE = 'Light · Steps needs calibration';

export const HeatSuggestion = suggestion('Heater 65% → 75%', '4 °C below target, RoR falling');
export const BothOutputs = suggestion('Heater 65% → 75% · Fan 50% → 40%', 'Maillard from 150 °C');
export const StepPhase = suggestion('Heater 70% → 85%', 'RoR 6.5 · step wants 8–12');
export const NeedsCalibration = suggestion('Heater 65% → 75%', 'RoR stalling', CALIBRATE);
export const FirstCrackSoon = headsUp('First crack in ~45 s · listen');
export const DropSoon = headsUp('Drop in ~30 s · 1:45 development');
export const CapSoonNeedsCalibration = headsUp('BT cap 225 °C in ~30 s', CALIBRATE);
