import { silentLogger } from '@roastpilot/core';
import { err, ok, type Bean } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { openBeanLink } from './open-bean-link';

const bean = (link: string | null) => ({ id: 1, name: 'African Moon', link }) as Bean;

function deps(beans: Bean[], openExternal = vi.fn(() => Promise.resolve())) {
  return {
    beans: { read: () => Promise.resolve(ok(beans)) },
    openExternal,
    logger: silentLogger,
  };
}

describe('openBeanLink', () => {
  it("opens the bean's saved link", async () => {
    const d = deps([bean('https://shop.example/african-moon')]);
    expect(await openBeanLink(1, d)).toEqual(ok(undefined));
    expect(d.openExternal).toHaveBeenCalledWith('https://shop.example/african-moon');
  });

  it('opens nothing for a bean without a link, or one that is not a web address', async () => {
    for (const link of [null, 'file:///etc/passwd', 'javascript:alert(1)']) {
      const d = deps([bean(link)]);
      expect(await openBeanLink(1, d)).toEqual(err({ kind: 'no-link', id: 1 }));
      expect(d.openExternal).not.toHaveBeenCalled();
    }
  });

  it('says when the bean is gone or the browser would not open', async () => {
    expect(await openBeanLink(2, deps([bean('https://a.example')]))).toEqual(
      err({ kind: 'bean-not-found', id: 2 }),
    );
    const failing = deps(
      [bean('https://a.example')],
      vi.fn(() => Promise.reject(new Error('no browser'))),
    );
    expect(await openBeanLink(1, failing)).toEqual(err({ kind: 'open-failed' }));
  });
});
