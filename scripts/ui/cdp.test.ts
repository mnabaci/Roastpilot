import { describe, expect, it } from 'vitest';
import { pickPage } from './cdp.ts';

describe('pickPage', () => {
  it('picks the app window, not devtools or a worker', () => {
    const page = { type: 'page', url: 'http://localhost:5173/', webSocketDebuggerUrl: 'ws://p' };
    expect(
      pickPage([
        { type: 'service_worker', url: 'x' },
        { type: 'page', url: 'devtools://devtools/bundled/x.html' },
        page,
      ]),
    ).toBe(page);
  });

  it('finds nothing when the window is not open yet', () => {
    expect(pickPage([])).toBeUndefined();
  });
});
