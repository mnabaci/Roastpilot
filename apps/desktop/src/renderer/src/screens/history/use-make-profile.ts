import type { RoastId } from '@roastpilot/shared';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';

export type ProfileStyle = 'steps' | 'curve';

/** A new profile of your own from a roast, which stays as it is; one line when it can't. */
export function useMakeProfile(onOpenProfile: (id: string) => void): {
  make: (roastId: RoastId, style: ProfileStyle) => void;
  note: string | undefined;
} {
  const { api, stores, logger } = useDeps();
  const run = useRun();
  const [note, setNote] = useState<string>();
  const make = (roastId: RoastId, style: ProfileStyle) => {
    setNote(undefined);
    run('history.make-profile-failed', async () => {
      const made = await api.makeProfileFromRoast({ roastId, style });
      if (!made.ok) {
        logger.info('history.make-profile-refused', { ...made.error });
        setNote(
          made.error.kind === 'too-short'
            ? 'Too little to go on · it needs a first crack, and a drop hotter than its charge'
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
  };
  return { make, note };
}
