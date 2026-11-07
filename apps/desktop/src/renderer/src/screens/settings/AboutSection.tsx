import { isRoastRunning, type ReleasePage } from '@roastpilot/shared';
import { Button } from '@roastpilot/ui';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useToast } from '../../features/use-toast';
import { useRoast, useUpdates } from '../../stores/use-stores';
import { SettingCard, SettingRow } from './SettingRow';
import { updateCopy } from './update-copy';

/** Version and updates (docs/spec/install-and-update.md, What you see): one line, one button. */
export function AboutSection() {
  const { api, logger } = useDeps();
  const run = useRun();
  const toast = useToast();
  const version = useUpdates((s) => s.version);
  const status = useUpdates((s) => s.status);
  const roasting = useRoast((s) => isRoastRunning(s.roast));
  const { line, action, busy = false } = updateCopy(status);

  const openPage = (page: ReleasePage) => {
    run(
      'about.open-release-page-failed',
      async () => {
        const result = await api.openReleasePage(page);
        if (!result.ok) {
          logger.info('about.release-page-refused', { page, ...result.error });
          toast('error', "Couldn't open the release page · try again");
        }
      },
      { failed: "Couldn't open the release page · try again" },
    );
  };
  const check = () => {
    run('about.check-failed', () => api.checkForUpdates(), {
      failed: "Couldn't check · try again",
    });
  };
  const restart = () => {
    run(
      'about.restart-failed',
      async () => {
        const result = await api.restartToUpdate();
        if (result.ok) return;
        logger.info('about.restart-refused', { ...result.error });
        toast(
          'error',
          result.error.kind === 'roasting'
            ? 'Finish the roast first'
            : "Couldn't start the update · try again",
        );
      },
      { failed: "Couldn't start the update · try again" },
    );
  };

  return (
    <SettingCard title="About">
      <SettingRow name="Version" hint="Release notes on GitHub">
        <div className="flex items-center gap-3">
          <span className="text-body font-semibold tabular-nums">{version ?? '–'}</span>
          {version !== null && status?.state !== 'off' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                openPage('installed');
              }}
            >
              What&apos;s new
            </Button>
          ) : null}
        </div>
      </SettingRow>
      <SettingRow name="Updates" hint={line}>
        {action === 'check' ? (
          <Button disabled={busy} onClick={check}>
            Check for updates
          </Button>
        ) : null}
        {action === 'restart' ? (
          <>
            <Button variant="primary" disabled={roasting} onClick={restart}>
              Restart to update
            </Button>
            {roasting ? <p className="text-label text-ink-muted">Finish the roast first</p> : null}
          </>
        ) : null}
        {action === 'download' ? (
          <Button
            variant="primary"
            onClick={() => {
              openPage('latest');
            }}
          >
            Download
          </Button>
        ) : null}
      </SettingRow>
    </SettingCard>
  );
}
