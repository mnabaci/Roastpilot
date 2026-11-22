import {
  SPEC_SHEET_TEXT_MAX,
  type ReadSpecSheetRequest,
  type SpecSheetFields,
} from '@roastpilot/shared';
import { Button, Dialog, TextAreaField } from '@roastpilot/ui';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { aiReadMessage } from '../../features/ai-messages';
import { useRun } from '../../features/use-run';

/**
 * Fill from spec sheet (docs/spec/beans-favourites-ghost.md): paste the sheet's text and Fill, or
 * Choose PDF…, which main opens. What comes back goes to `onFilled`; nothing is saved here.
 */
export function SpecSheetDialog({
  open,
  onClose,
  onFilled,
}: {
  open: boolean;
  onClose: () => void;
  onFilled: (fields: SpecSheetFields) => void;
}) {
  const { api } = useDeps();
  const run = useRun();
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string>();
  const read = (request: ReadSpecSheetRequest) => {
    if (reading) return;
    setReading(true);
    setProblem(undefined);
    run(
      'beans.sheet-read-failed',
      async () => {
        try {
          const answer = await api.readSpecSheet(request);
          if (!answer.ok) {
            setProblem(aiReadMessage(answer.error, 'fields'));
            return;
          }
          if (answer.value.status === 'cancelled') return;
          if (Object.keys(answer.value.fields).length === 0) {
            setProblem('Nothing to fill from that sheet');
            return;
          }
          onFilled(answer.value.fields);
          setText('');
          onClose();
        } finally {
          setReading(false);
        }
      },
      { failed: "Couldn't read the sheet · try again" },
    );
  };
  const typed = text.trim();
  return (
    <Dialog
      open={open}
      onOpenChange={(opened) => {
        if (!opened) onClose();
      }}
      title="Fill from spec sheet"
      description="Fills empty fields only · check them, then Save"
    >
      <TextAreaField
        label="Paste the sheet"
        tall
        value={text}
        maxLength={SPEC_SHEET_TEXT_MAX}
        onChange={setText}
      />
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          size="sm"
          variant="ghost"
          icon={<FileText />}
          disabled={reading}
          onClick={() => {
            read({ kind: 'pdf' });
          }}
        >
          Choose PDF…
        </Button>
        <div className="flex gap-2">
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={reading || typed === ''}
            onClick={() => {
              read({ kind: 'text', text: typed });
            }}
          >
            {reading ? 'Reading…' : 'Fill'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
