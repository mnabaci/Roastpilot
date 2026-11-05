import { Badge, Button } from '@roastpilot/ui';
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
    <main className="flex min-h-0 flex-1 overflow-hidden">
      <nav
        aria-label="Profiles"
        className="flex w-54 shrink-0 flex-col gap-1 overflow-y-auto py-6 pl-6"
      >
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
      {/* Only this side scrolls. Relative, so screen-reader-only labels scroll with the table. */}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto p-6">
        {open ? <ProfileEditor key={open.profile.id} entry={open} onSelect={setOpenId} /> : null}
      </div>
    </main>
  );
}
