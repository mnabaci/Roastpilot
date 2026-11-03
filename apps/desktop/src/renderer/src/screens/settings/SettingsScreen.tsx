import { ConnectionSection } from './ConnectionSection';
import { ControlsSection } from './ControlsSection';

export function SettingsScreen() {
  return (
    <main className="flex w-full max-w-xl flex-col gap-8 p-6">
      <h1 className="text-title">Settings</h1>
      <ConnectionSection />
      <ControlsSection />
    </main>
  );
}
