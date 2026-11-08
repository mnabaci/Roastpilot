import { NavList, SidebarLayout } from '@roastpilot/ui';
import type { ReactNode } from 'react';
import { AboutSection } from './AboutSection';
import { AppearanceSection } from './AppearanceSection';
import { ChartSection } from './ChartSection';
import { ControlsSection } from './ControlsSection';
import { RoastSection } from './RoastSection';
import { SoundsSection } from './SoundsSection';
import { SETTINGS_SECTIONS, type SettingsSection } from './settings-section';

const SECTION: Readonly<Record<SettingsSection, () => ReactNode>> = {
  controls: () => <ControlsSection />,
  roast: () => <RoastSection />,
  sounds: () => <SoundsSection />,
  chart: () => <ChartSection />,
  appearance: () => <AppearanceSection />,
  about: () => <AboutSection />,
};

/** The sections in the shared sidebar, one open (docs/spec/ui.md, Settings). */
export function SettingsScreen({
  section,
  onSection,
}: {
  section: SettingsSection;
  onSection: (section: SettingsSection) => void;
}) {
  return (
    <SidebarLayout
      title="Settings"
      contentLabel="Section"
      sidebar={
        <NavList label="Sections" items={SETTINGS_SECTIONS} openId={section} onOpen={onSection} />
      }
    >
      {SECTION[section]()}
    </SidebarLayout>
  );
}
