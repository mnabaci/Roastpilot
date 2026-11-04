import { useState, type ReactNode } from 'react';
import { LogsScreen } from '../screens/logs/LogsScreen';
import { RoastScreen } from '../screens/roast/RoastScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { useConnection, useSync } from '../stores/use-stores';
import { SafetyBanners } from './SafetyBanners';
import { TopBar, type Screen } from './TopBar';

/** The app shell: top bar, safety banners, and the current screen. */
export function App() {
  const ready = useSync((s) => s.ready);
  // Start where the next action is: Settings until a roaster is connected. Connecting stays on
  // Settings, so a failed connect is explained where it was started.
  const connected = useConnection(
    (s) => s.connection.status === 'connected' || s.connection.status === 'lost',
  );
  const [screen, setScreen] = useState<Screen | undefined>();
  const shown = screen ?? (connected ? 'roast' : 'settings');
  const screens: Readonly<Record<Screen, () => ReactNode>> = {
    roast: () => (
      <RoastScreen
        onConnect={() => {
          setScreen('settings');
        }}
      />
    ),
    settings: () => <SettingsScreen />,
    logs: () => <LogsScreen />,
  };
  return (
    <div className="flex min-h-screen flex-col bg-bg font-sans text-ink">
      <TopBar screen={shown} onNavigate={setScreen} />
      <SafetyBanners />
      {ready ? screens[shown]() : null}
    </div>
  );
}
