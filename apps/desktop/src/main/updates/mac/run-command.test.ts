import { describe, expect, it } from 'vitest';
import { runCommand } from './run-command';

describe.skipIf(process.platform === 'win32')('runCommand', () => {
  it('answers what the program printed; arguments are never read by a shell', async () => {
    expect(await runCommand('/bin/echo', ['a b', '$HOME', ';ls'])).toEqual({
      ok: true,
      value: 'a b $HOME ;ls\n',
    });
  });

  it('a program that fails says which one and what it printed', async () => {
    const result = await runCommand('/bin/sh', ['-c', 'echo nope >&2; exit 3']);
    expect(result).toEqual({ ok: false, error: { message: '/bin/sh failed: nope' } });
  });

  it('a program that is not there is a failure, not a throw', async () => {
    const result = await runCommand('/no/such/program', []);
    expect(result.ok).toBe(false);
  });
});
