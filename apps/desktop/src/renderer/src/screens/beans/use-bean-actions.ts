import { suggestProfile } from '@roastpilot/core';
import type { Bean, RoastSummary } from '@roastpilot/shared';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { activeRoaster } from '../../stores/roasters-store';
import { activeEntry } from '../roast/use-active-profile';
import { useAuto, useRoast, useRoasters } from '../../stores/use-stores';
import { setupForBean } from '../roast/roast-setup';

/**
 * What a bean's header can do: roast it, order it again, make it a profile, archive it; one line
 * when it fails.
 */
export function useBeanActions({
  bean,
  beans,
  roasts,
  onRoast,
  onOpenProfile,
}: {
  bean: Bean;
  beans: readonly Bean[];
  roasts: readonly RoastSummary[];
  onRoast: () => void;
  onOpenProfile: (id: string) => void;
}): {
  /** Roast this bean can't start: archived, no roaster, or a roast is running. */
  roastBlocked: boolean;
  /** Make a profile needs one to copy on the active roaster. */
  canMakeProfile: boolean;
  roastThis: () => void;
  makeProfile: () => void;
  /** Opens the bean's order link in the browser. */
  orderAgain: () => void;
  archive: () => void;
  problem: string | undefined;
} {
  const { api, stores } = useDeps();
  const run = useRun();
  const [problem, setProblem] = useState<string>();
  const profiles = useAuto((s) => s.profiles);
  // The running roast keeps its bean: the next one is set up once it's over.
  const roastRunning = useRoast((s) => s.roast.phase !== 'ready' && s.roast.phase !== 'done');
  const roaster = activeRoaster(useRoasters((s) => s.roasters));

  const roastThis = () => {
    if (!roaster) return;
    const { settings } = stores.settings.getState();
    const setup = setupForBean(bean, {
      plan: {
        roaster,
        profiles,
        autoProfileG: activeEntry(profiles, settings.autoProfile)?.profile.batchG,
      },
      roasts,
      profileId: settings.autoProfile,
    });
    stores.beans.setState({ setup });
    run(
      'beans.setup-failed',
      async () => {
        await api.setRoastSetup(setup);
        onRoast();
      },
      { failed: "Couldn't set up the roast · try again" },
    );
  };

  /**
   * The bean's own profile, in one call: main copies the suggested profile, names it after the
   * bean and links it, all or nothing. Then it opens in the editor.
   */
  const makeProfile = () => {
    const suggested = suggestProfile({
      bean,
      beans,
      roasts,
      available: profiles.map((e) => e.profile.id),
    });
    if (!suggested) return;
    setProblem(undefined);
    run(
      'beans.make-profile-failed',
      async () => {
        const made = await api.makeBeanProfile({
          beanId: bean.id,
          profileId: suggested.profileId,
        });
        if (!made.ok) {
          setProblem("Couldn't make the profile · see Logs");
          return;
        }
        stores.auto.setState({ profiles: await api.listProfiles() });
        onOpenProfile(made.value.profile.id);
      },
      { failed: "Couldn't make the profile · try again" },
    );
  };

  // Main opens the link saved with the bean; the screen only names the bean.
  const orderAgain = () => {
    setProblem(undefined);
    run(
      'beans.link-failed',
      async () => {
        const opened = await api.openBeanLink(bean.id);
        if (!opened.ok) setProblem("Couldn't open the order link · see Logs");
      },
      { failed: "Couldn't open the order link · try again" },
    );
  };

  const archive = () => {
    run(
      'beans.archive-failed',
      async () => {
        const done = await api.setBeanArchived({ id: bean.id, archived: !bean.archived });
        setProblem(done.ok ? undefined : "Couldn't change that · see Logs");
      },
      { failed: "Couldn't change the bean · try again" },
    );
  };

  return {
    roastBlocked: bean.archived || roastRunning || !roaster,
    canMakeProfile: profiles.length > 0,
    roastThis,
    makeProfile,
    orderAgain,
    archive,
    problem,
  };
}
