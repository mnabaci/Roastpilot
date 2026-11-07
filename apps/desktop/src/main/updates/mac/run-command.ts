import { err, ok, type Result } from '@roastpilot/shared';
import { execFile } from 'node:child_process';

/** Why a step of the Mac installer failed; becomes the updater's failure message. */
export interface StepFailure {
  message: string;
}

/** Runs a program with arguments (never a shell string) and answers its output. */
export type RunCommand = (
  file: string,
  args: readonly string[],
) => Promise<Result<string, StepFailure>>;

/** Unpacking a large app takes a while; anything slower is stuck. */
const COMMAND_TIMEOUT_MS = 5 * 60 * 1000;

/** `RunCommand` through `execFile`: a failure says which program and what it printed. */
export const runCommand: RunCommand = (file, args) =>
  new Promise((resolve) => {
    execFile(file, [...args], { timeout: COMMAND_TIMEOUT_MS }, (error, stdout, stderr) => {
      if (error) {
        const said = stderr.trim();
        resolve(err({ message: `${file} failed: ${said === '' ? error.message : said}` }));
        return;
      }
      resolve(ok(stdout));
    });
  });
