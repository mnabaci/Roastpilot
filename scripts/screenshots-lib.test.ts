import { describe, expect, it } from 'vitest';
import { chromePath, contentType, devtoolsUrl, pngSize, scenesIn } from './screenshots-lib.ts';

describe('scenesIn', () => {
  it('takes the Screens stories and names each image after it', () => {
    const index = {
      entries: {
        'screens--roast-auto': { type: 'story' },
        'screens--docs': { type: 'docs' },
        'button--primary': { type: 'story' },
      },
    };
    expect(scenesIn(index)).toEqual([{ storyId: 'screens--roast-auto', image: 'roast-auto.png' }]);
  });

  it('finds none in an index without entries', () => {
    expect(scenesIn({})).toEqual([]);
  });
});

describe('pngSize', () => {
  it('reads width and height from the header', () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(png.buffer);
    view.setUint32(16, 1440);
    view.setUint32(20, 900);
    expect(pngSize(png)).toEqual({ width: 1440, height: 900 });
  });

  it('refuses what is not a PNG, or too short to have a size', () => {
    expect(pngSize(new TextEncoder().encode('not a png at all, really'))).toBeUndefined();
    expect(pngSize(new Uint8Array([0x89, 0x50]))).toBeUndefined();
  });
});

describe('devtoolsUrl', () => {
  it('finds the address in what Chrome prints', () => {
    const out = '\nDevTools listening on ws://127.0.0.1:53111/devtools/browser/abc-123\n';
    expect(devtoolsUrl(out)).toBe('ws://127.0.0.1:53111/devtools/browser/abc-123');
  });

  it('is undefined until Chrome has said it', () => {
    expect(devtoolsUrl('[1108/0912:WARNING] something else')).toBeUndefined();
  });
});

describe('chromePath', () => {
  it('takes CHROME_PATH first', () => {
    expect(chromePath('darwin', { CHROME_PATH: '/opt/chrome' })).toBe('/opt/chrome');
  });

  it('knows where Chrome usually is on macOS and Windows', () => {
    expect(chromePath('darwin', {})).toContain('Google Chrome.app');
    expect(chromePath('win32', { PROGRAMFILES: 'D:\\Apps' })).toBe(
      'D:\\Apps\\Google\\Chrome\\Application\\chrome.exe',
    );
  });
});

describe('contentType', () => {
  it('serves the build with the right types', () => {
    expect(contentType('iframe.html')).toBe('text/html; charset=utf-8');
    expect(contentType('assets/x.JS')).toBe('text/javascript; charset=utf-8');
    expect(contentType('x.unknown')).toBe('application/octet-stream');
  });
});
