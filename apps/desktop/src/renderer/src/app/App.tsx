import { useState } from 'react';
import { useConnection, useSync } from '../stores/use-stores';
import { RoastScreen } from '../screens/roast/RoastScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { SafetyBanners } from './SafetyBanners';
import { TopBar, type Screen } from './TopBar';

/** The app shell: top bar, safety banners, and the Roast or Settings screen. */
export function App() {
  const ready = useSync((s) => s.ready);
  const connected = useConnection((s) => s.connection.status !== 'disconnected');
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
