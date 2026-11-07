import type { ExportRoastsRequest, RoastId } from '@roastpilot/shared';
import { Button, Menu } from '@roastpilot/ui';

/** While selecting: how many are ticked and what can be done with them. */
export function SelectionBar({
  checked,
  onExport,
  onDone,
}: {
  checked: ReadonlySet<RoastId>;
  onExport: (request: ExportRoastsRequest) => void;
  onDone: () => void;
}) {
  return (
    <div className="flex items-center gap-2" role="toolbar" aria-label="Selected roasts">
      <span className="mr-auto text-label text-ink-muted" aria-live="polite">
        {checked.size} selected
      </span>
      <Menu
        label="Export selected"
        text="Export"
        items={(['roastpilot', 'csv'] as const).map((format) => ({
          label: format === 'csv' ? 'CSV' : 'Roastpilot file',
          disabled: checked.size === 0,
          onSelect: () => {
            onExport({ format, ids: [...checked] });
          },
        }))}
      />
      <Button size="sm" variant="outline" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
