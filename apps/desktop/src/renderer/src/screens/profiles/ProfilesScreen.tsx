import { Badge, Button } from '@roastpilot/ui';
import { useState } from 'react';
import { useAuto, useSettings } from '../../stores/use-stores';
import { activeEntry } from '../roast/use-active-profile';
import { ProfileEditor } from './ProfileEditor';

/** Your profiles and the built-ins, with one open to edit (docs/spec/ui.md, Profiles screen). */
export function ProfilesScreen() {
  const profiles = useAuto((s) => s.profiles);
  const drafts = useAuto((s) => s.drafts);
  const chosenId = useSettings((s) => s.settings.autoProfile);
  const [openId, setOpenId] = useState<string>();
  const open = profiles.find((e) => e.profile.id === openId) ?? activeEntry(profiles, chosenId);
  // Relative, so screen-reader-only labels scroll with the table instead of growing the page.
  return (
    <main className="relative flex min-h-0 flex-1 gap-6 overflow-y-auto p-6">
      <nav aria-label="Profiles" className="flex w-48 shrink-0 flex-col gap-1">
        <h1 className="pb-2 text-title">Profiles</h1>
        {profiles.map(({ profile }) => (
          <Button
            key={profile.id}
            variant="ghost"
            title={profile.name}
            aria-current={open?.profile.id === profile.id ? 'true' : undefined}
            className={
              open?.profile.id === profile.id
                ? 'justify-start bg-surface-raised text-left text-ink'
                : 'justify-start text-left text-ink-muted hover:text-ink'
            }
            onClick={() => {
              setOpenId(profile.id);
            }}
          >
            <span className="truncate">{profile.name}</span>
            {drafts[profile.id] ? <Badge tone="heat">Edited</Badge> : null}
          </Button>
        ))}
      </nav>
      {open ? <ProfileEditor key={open.profile.id} entry={open} onSelect={setOpenId} /> : null}
    </main>
  );
}
