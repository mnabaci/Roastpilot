import { cn } from '@roastpilot/ui';
import type { FileMessage } from './use-roast-files';

/** How the last import or export went, in one line; an alert when it didn't work. */
export function FileNote({ message }: { message: FileMessage | undefined }) {
  if (!message) return null;
  return (
    <p
      {...(message.problem ? { role: 'alert' } : {})}
      className={cn('text-label', message.problem ? 'text-critical-text' : 'text-ink-muted')}
    >
      {message.text}
    </p>
  );
}
