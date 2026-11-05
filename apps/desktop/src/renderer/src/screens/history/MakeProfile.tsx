import type { RoastId } from '@roastpilot/shared';
import { Button } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';

const STYLES = [
  { style: 'steps', label: 'Make step profile' },
  { style: 'curve', label: 'Make curve profile' },
] as const;

/** A new profile of your own from this roast, which stays as it is. */
export function MakeProfile({
  roastId,
  onOpenProfile,
}: {
  roastId: RoastId;
  onOpenProfile: (id: string) => void;
}) {
  const { api, stores, logger } = useDeps();
  const run = useRun();
  const [note, setNote] = useState<string>();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {STYLES.map(({ style, label }) => (
          <Button
            key={style}
            onClick={() => {
              run('history.make-profile-failed', async () => {
                const made = await api.makeProfileFromRoast({ roastId, style });
                if (!made.ok) {
                  logger.info('history.make-profile-refused', { ...made.error });
                  setNote(
                    made.error.kind === 'too-short'
                      ? 'Too little to go on · it needs a first crack and a drop'
                      : "Couldn't make the profile · see Logs",
                  );
                  return;
                }
                const profiles = await api.listProfiles();
                stores.auto.setState({ profiles });
                const { id } = made.value.profile;
                if (profiles.some((e) => e.profile.id === id)) onOpenProfile(id);
                else setNote('Made on the roaster this roast ran on · switch to it to edit');
              });
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {note ? (
        <p role="status" className="text-label text-ink-muted">
          {note}
        </p>
      ) : null}
    </div>
  );
}
