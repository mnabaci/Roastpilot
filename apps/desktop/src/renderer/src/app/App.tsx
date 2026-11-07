import { needsSafetyNotice, SAFETY_NOTICE_VERSION, type Screen } from '@roastpilot/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { BeansScreen } from '../screens/beans/BeansScreen';
import { HistoryScreen } from '../screens/history/HistoryScreen';
import { LogsScreen } from '../screens/logs/LogsScreen';
import { ProfilesScreen } from '../screens/profiles/ProfilesScreen';
import { RoastersScreen } from '../screens/roasters/RoastersScreen';
import { RoastScreen } from '../screens/roast/RoastScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import type { SettingsSection } from '../screens/settings/settings-section';
import { useConnection, useSettings, useSync } from '../stores/use-stores';
import { useSaveSettings } from '../screens/settings/use-save-settings';
import { SafetyNotice } from './SafetyNotice';
import { SafetyBanners } from './SafetyBanners';
import { useDeps } from './app-context';
import { LiveRoastStrip } from './LiveRoastStrip';
import { TopBar } from './TopBar';
import { useSounds } from './use-sounds';
import { useTheme } from './use-theme';
import { AppToaster } from './AppToaster';
import { ScreenError } from './ScreenError';
import { ErrorBoundary } from '../features/ErrorBoundary';
import { serializeError } from '@roastpilot/core';

const SAFETY_NOTICE_NOT_SAVED = "Couldn't save · the safety notice shows again next launch";

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
  const { api, logger } = useDeps();
  const firstLaunch = useSettings((s) => needsSafetyNotice(s.settings));
  // Help → Safety notice: shown in the screen area, under the top bar and banners.
  const [noticeOpen, setNoticeOpen] = useState(false);
  const saveSettings = useSaveSettings(SAFETY_NOTICE_NOT_SAVED);
  // Here, mounted once, so the chimes play once and in this window only.
  useSounds();
  useTheme();
  // The app menu (Settings… ⌘,) opens screens too; opening one closes the safety notice.
  useEffect(
    () =>
      api.onNavigate((next) => {
        setNoticeOpen(false);
        setScreen(next);
      }),
    [api],
  );
  useEffect(
    () =>
      api.onShowSafetyNotice(() => {
        setNoticeOpen(true);
      }),
    [api],
  );
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
  // First launch: the notice fills the window before anything else (docs/spec/safety.md).
  if (ready && firstLaunch) {
    return (
      <div className="h-screen overflow-y-auto bg-bg font-sans text-ink">
        <SafetyNotice
          action="accept"
          onDone={() => {
            saveSettings({ safetyNoticeAccepted: SAFETY_NOTICE_VERSION });
          }}
        />
        <AppToaster screen={shown} />
      </div>
    );
  }
  return (
    // A fixed frame: the top bar and safety banners never scroll away; each screen scrolls inside.
    <div className="flex h-screen flex-col overflow-hidden bg-bg font-sans text-ink">
      <TopBar
        screen={shown}
        onNavigate={(next) => {
          setNoticeOpen(false);
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
      <div className="flex min-h-0 flex-1 flex-col">
        {/* A screen that fails to draw shows its error page; opening another screen leaves it. */}
        <ErrorBoundary
          resetKey={shown}
          onError={(error, info) => {
            logger.error('renderer.screen-failed', {
              screen: shown,
              error: serializeError(error),
              componentStack: info.componentStack,
            });
          }}
          fallback={(error) => <ScreenError screen={shown} error={error} />}
        >
          {noticeOpen ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SafetyNotice
                action="close"
                onDone={() => {
                  setNoticeOpen(false);
                }}
              />
            </div>
          ) : ready ? (
            screens[shown]()
          ) : null}
        </ErrorBoundary>
      </div>
      <AppToaster screen={shown} />
    </div>
  );
}
