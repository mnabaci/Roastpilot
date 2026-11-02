import { describe, expect, it } from 'vitest';
import { terminalLogSink } from './terminal-log-sink';

describe('terminalLogSink', () => {
  it('prints later, never inside the caller', async () => {
    const written: string[] = [];
    const sink = terminalLogSink({ write: (s: string) => written.push(s) > 0 });
    sink.write({
      level: 'warn',
      scope: 'session',
      event: 'session.read-failed',
      context: { kind: 'no-reply' },
    });
    expect(written).toEqual([]);
    await new Promise((resolve) => setImmediate(resolve));
    expect(written).toEqual(['[warn] session session.read-failed {"kind":"no-reply"}\n']);
  });
});
