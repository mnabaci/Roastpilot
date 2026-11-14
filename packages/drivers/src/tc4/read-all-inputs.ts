import type { DriverError } from '@roastpilot/core';
import type { Result } from '@roastpilot/shared';
import type { Tc4InputProbe, Tc4Link } from './tc4-dialect';

/** Every input at once: select them all, read, then put the record's channels back whatever happened. */
export async function readAllInputs(
  link: Tc4Link,
  probe: Tc4InputProbe,
): Promise<Result<(number | null)[], DriverError>> {
  const selected = await link.send(probe.select);
  if (!selected.ok) return selected;
  const answer = await link.request('READ', probe.isReply);
  // Polling reads the record's channels again, so restore them even when the read failed.
  const restored = await link.send(probe.restore);
  if (!answer.ok) return answer;
  if (!restored.ok) return restored;
  return probe.parse(answer.value);
}
