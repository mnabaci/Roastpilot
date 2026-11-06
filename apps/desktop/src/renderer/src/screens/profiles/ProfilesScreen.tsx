import { Badge, NavList, SidebarLayout } from '@roastpilot/ui';
import { useState } from 'react';
import { useAuto, useSettings } from '../../stores/use-stores';
import { activeEntry } from '../roast/use-active-profile';
import { ProfileEditor } from './ProfileEditor';

/** Your profiles and the built-ins, with one open to edit (docs/spec/ui.md, Profiles screen). */
export function ProfilesScreen({ openFirst }: { openFirst?: string | undefined }) {
  const profiles = useAuto((s) => s.profiles);
  const drafts = useAuto((s) => s.drafts);
  const chosenId = useSettings((s) => s.settings.autoProfile);
  const [openId, setOpenId] = useState(openFirst);
  const open = profiles.find((e) => e.profile.id === openId) ?? activeEntry(profiles, chosenId);
  return (
    <SidebarLayout
      title="Profiles"
      contentLabel="Profile"
      sidebar={
        <NavList
          label="Profiles"
          items={profiles.map(({ profile }) => ({
            id: profile.id,
            label: profile.name,
            badge: drafts[profile.id] ? <Badge tone="heat">Edited</Badge> : undefined,
          }))}
          openId={open?.profile.id}
          onOpen={setOpenId}
        />
      }
    >
      {open ? <ProfileEditor key={open.profile.id} entry={open} onSelect={setOpenId} /> : null}
    </SidebarLayout>
  );
}
