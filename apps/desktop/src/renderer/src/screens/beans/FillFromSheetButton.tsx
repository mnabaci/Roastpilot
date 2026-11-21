import { Button } from '@roastpilot/ui';
import { FileText } from 'lucide-react';

/** Opens Fill from spec sheet: quiet, before Cancel in a bean's edit header. */
export function FillFromSheetButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="ghost" icon={<FileText />} onClick={onClick}>
      Fill from spec sheet
    </Button>
  );
}
