import { ConnectionSection } from './ConnectionSection';
import { ChartSection } from './ChartSection';
import { ControlsSection } from './ControlsSection';
import { RoastSection } from './RoastSection';

export function SettingsScreen() {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="flex max-w-xl flex-col gap-8">
        <h1 className="text-title">Settings</h1>
        <ConnectionSection />
        <ControlsSection />
        <RoastSection />
        <ChartSection />
      </div>
    </main>
  );
}
