import { useState } from 'react';
import { useAppState } from './state/app-context';
import { RoastScreen } from './screens/RoastScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SafetyBanners } from './shell/SafetyBanners';
import { TopBar, type Screen } from './shell/TopBar';

/** The app shell: top bar, safety banners, and the Roast or Settings screen. */
export function App() {
  const ready = useAppState((s) => s.ready);
  const connected = useAppState((s) => s.connection.status !== 'disconnected');
  // Start where the next action is: Settings until a roaster is connected.
  const [screen, setScreen] = useState<Screen | undefined>();
  const shown = screen ?? (connected ? 'roast' : 'settings');
  return (
    <div className="flex min-h-screen flex-col bg-bg font-sans text-ink">
      <TopBar screen={shown} onNavigate={setScreen} />
      <SafetyBanners />
      {!ready ? null : shown === 'roast' ? (
        <RoastScreen
          onConnect={() => {
            setScreen('settings');
          }}
        />
      ) : (
        <SettingsScreen />
      )}
    </div>
  );
}
