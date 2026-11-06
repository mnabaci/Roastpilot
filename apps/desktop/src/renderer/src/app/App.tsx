import type { Screen } from '@roastpilot/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { BeansScreen } from '../screens/beans/BeansScreen';
import { HistoryScreen } from '../screens/history/HistoryScreen';
import { LogsScreen } from '../screens/logs/LogsScreen';
import { ProfilesScreen } from '../screens/profiles/ProfilesScreen';
import { RoastersScreen } from '../screens/roasters/RoastersScreen';
import { RoastScreen } from '../screens/roast/RoastScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import type { SettingsSection } from '../screens/settings/settings-section';
import { useConnection, useSync } from '../stores/use-stores';
import { SafetyBanners } from './SafetyBanners';
import { useDeps } from './app-context';
import { LiveRoastStrip } from './LiveRoastStrip';
import { TopBar } from './TopBar';

/** The app shell: top bar, safety banners, and the current screen. */
export function App() {
  const ready = useSync((s) => s.ready);
  // Start where the next action is: Roasters until a roaster is connected. Connecting stays on
  // Roasters, so a failed connect is explained where it was started.
  const connected = useConnection(
    (s) => s.connection.status === 'connected' || s.connection.status === 'lost',
  );
  const [screen, setScreen] = useState<Screen | undefined>();
  const [profileToOpen, setProfileToOpen] = useState<string>();
  // Settings reopens on the last section viewed until quit (docs/spec/ui.md, Settings).
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('controls');
  const { api } = useDeps();
  // The app menu (Settings… ⌘,) opens screens too.
  useEffect(() => api.onNavigate(setScreen), [api]);
  const shown = screen ?? (connected ? 'roast' : 'roasters');
  const screens: Readonly<Record<Screen, () => ReactNode>> = {
    roast: () => (
      <RoastScreen
        onConnect={() => {
          setScreen('roasters');
        }}
      />
    ),
    history: () => (
      <HistoryScreen
        onOpenProfile={(id) => {
          setProfileToOpen(id);
          setScreen('profiles');
        }}
      />
    ),
    beans: () => (
      <BeansScreen
        onRoast={() => {
          setScreen('roast');
        }}
        onOpenProfile={(id) => {
          setProfileToOpen(id);
          setScreen('profiles');
        }}
      />
    ),
    profiles: () => <ProfilesScreen openFirst={profileToOpen} />,
    roasters: () => <RoastersScreen />,
    settings: () => <SettingsScreen section={settingsSection} onSection={setSettingsSection} />,
    logs: () => <LogsScreen />,
  };
  return (
    // A fixed frame: the top bar and safety banners never scroll away; each screen scrolls inside.
    <div className="flex h-screen flex-col overflow-hidden bg-bg font-sans text-ink">
      <TopBar
        screen={shown}
        onNavigate={(next) => {
          setProfileToOpen(undefined);
          setScreen(next);
        }}
      />
      <SafetyBanners />
      {/* On the other screens, what the roast needs from you (docs/spec/ui.md, Roast strip). */}
      {ready && shown !== 'roast' ? (
        <LiveRoastStrip
          onOpen={() => {
            setScreen('roast');
          }}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col">{ready ? screens[shown]() : null}</div>
    </div>
  );
}
