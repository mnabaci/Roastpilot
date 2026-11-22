import type { AiProviderEntry, AiProviderId } from '@roastpilot/shared';
import { SegmentedControl } from '@roastpilot/ui';
import { SettingRow, SettingRows } from './SettingRow';
import { capableOf, jobLine, sheetReader, tasteReader } from './what-goes';

/**
 * Who reads what (docs/spec/ai-helpers.md, Turning it on): one row per job, saying where its text
 * goes and the model that reads it; tasting words can be given to another provider once two have
 * keys. Built from the providers main lists: nothing here names one.
 */
export function AiReadersCard({
  providers,
  chosen,
  onChoose,
}: {
  providers: readonly AiProviderEntry[];
  chosen: AiProviderId | null;
  onChoose: (provider: AiProviderId) => void;
}) {
  const tasteCapable = capableOf(providers, 'taste');
  const choosable = tasteCapable.filter((p) => p.key.saved).length > 1;
  const taste = tasteReader(providers, chosen);
  const sheets = sheetReader(providers);
  return (
    <SettingRows title="Who reads what">
      {tasteCapable.length > 0 ? (
        <SettingRow
          name="Tasting words"
          hint={
            tasteCapable.length > 1 && !choosable
              ? `${jobLine(taste, 'taste')} · a second key lets you choose`
              : jobLine(taste, 'taste')
          }
        >
          {tasteCapable.length > 1 ? (
            <SegmentedControl
              label="Read tasting words with"
              options={tasteCapable.map((p) => ({ value: p.id, label: p.label }))}
              // The reader actually used: with one key, that one, whatever was chosen before.
              value={taste?.id ?? chosen ?? tasteCapable[0]?.id ?? ''}
              disabled={!choosable}
              onChange={onChoose}
            />
          ) : (
            <Reader provider={taste} />
          )}
        </SettingRow>
      ) : null}
      {capableOf(providers, 'specSheet').length > 0 ? (
        <SettingRow name="Spec sheets" hint={jobLine(sheets, 'specSheet')}>
          <Reader provider={sheets} />
        </SettingRow>
      ) : null}
    </SettingRows>
  );
}

/** The provider that reads a job, where there is no choice to make; a dash with no key. */
function Reader({ provider }: { provider: AiProviderEntry | undefined }) {
  return <span className="text-body font-semibold">{provider?.label ?? '–'}</span>;
}
