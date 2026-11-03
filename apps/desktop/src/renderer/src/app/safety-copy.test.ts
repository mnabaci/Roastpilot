import { describe, expect, it } from 'vitest';
import { safetyCopy } from './safety-copy';

describe('safetyCopy', () => {
  it('safe-stop rules are critical, alarms are warnings', () => {
    expect(safetyCopy('max-temperature').kind).toBe('critical');
    expect(safetyCopy('slow-rise').kind).toBe('warning');
  });

  it('a rule without copy still gets a critical banner', () => {
    expect(safetyCopy('new-rule')).toEqual({
      kind: 'critical',
      text: 'Safety rule new-rule tripped',
    });
  });
});
