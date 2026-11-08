import type { Meta, StoryObj } from '@storybook/react-vite';
import { OctagonX, Sparkle } from 'lucide-react';
import { fn } from 'storybook/test';
import { Button } from '../components/Button';
import { CoachCard } from '../components/CoachCard';
import { OutputControl } from '../components/OutputControl';
import { PhaseStepper } from '../components/PhaseStepper';
import { StatCard } from '../components/StatCard';

/** How the components sit together on the Roast screen (no chart yet). */
function RoastPanel() {
  return (
    <div className="flex flex-col gap-5">
      <PhaseStepper steps={['Preheat', 'Roast', 'First crack', 'Drop', 'Cool']} current={1} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Temperature"
          value={163}
          unit="°C"
          context="Next step at 165 °C"
          tone="heat"
        />
        <StatCard label="Rate of rise" value="9.1" unit="°C/min" context="Band 8–10" tone="air" />
        <StatCard label="Elapsed" value="6:12" context="Since beans in" />
        <StatCard label="Development" value={null} context="After first crack" />
      </div>
      <div className="flex max-w-sm flex-col gap-4">
        <Button variant="primary" size="lg" icon={<Sparkle />} onClick={fn()}>
          First crack
        </Button>
        <CoachCard
          changes={[{ name: 'Heater', from: 50, to: 55, tone: 'heat' }]}
          reason="RoR 7.6, below the 8–10 band"
          onApply={fn()}
          onDismiss={fn()}
        />
        <div className="flex flex-col gap-5 rounded-xl bg-surface p-5">
          <OutputControl
            label="Heater"
            value={50}
            mode="manual"
            onChange={fn()}
            onResumeAuto={fn()}
          />
          <OutputControl label="Fan" value={65} mode="auto" tone="air" onChange={fn()} />
        </div>
        <Button variant="danger" icon={<OctagonX />} onClick={fn()}>
          Emergency stop
        </Button>
      </div>
    </div>
  );
}

const meta = {
  title: 'Compositions/Roast panel',
  component: RoastPanel,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof RoastPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ManualMaillard: Story = {};
