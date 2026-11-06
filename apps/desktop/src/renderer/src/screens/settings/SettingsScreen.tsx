import { NavList, SidebarLayout } from '@roastpilot/ui';
import type { ReactNode } from 'react';
import { AutoSection } from './AutoSection';
import { ChartSection } from './ChartSection';
import { ControlsSection } from './ControlsSection';
import { RoastSection } from './RoastSection';
import { SETTINGS_SECTIONS, type SettingsSection } from './settings-section';

const SECTION: Readonly<Record<SettingsSection, () => ReactNode>> = {
  controls: () => <ControlsSection />,
  roast: () => <RoastSection />,
  auto: () => <AutoSection />,
  chart: () => <ChartSection />,
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
