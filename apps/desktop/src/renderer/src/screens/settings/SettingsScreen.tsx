import { ConnectionSection } from './ConnectionSection';
import { ChartSection } from './ChartSection';
import { ControlsSection } from './ControlsSection';
import { RoastSection } from './RoastSection';

/** Two columns on a wide window (roaster on the left, roast on the right), one when narrow. */
export function SettingsScreen() {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-8">
        <h1 className="text-title">Settings</h1>
        <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="flex max-w-xl flex-col gap-8">
            <ConnectionSection />
            <ControlsSection />
          </div>
          <div className="flex max-w-xl flex-col gap-8">
            <RoastSection />
            <ChartSection />
          </div>
        </div>
      </div>
    </main>
  );
}
