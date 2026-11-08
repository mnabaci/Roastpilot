import { parseArgs } from 'node:util';

export const USAGE = `Drive the running Roastpilot app over the Chrome DevTools protocol.

  pnpm ui eval '<expression>'           evaluate in the window, print the JSON result
  pnpm ui click '<label>' ['<label>'…]  click by exact text, in order
  pnpm ui scroll-end ['<heading>']      scroll the scroller around a heading (or all) to the end
  pnpm ui shot <file.png> [--width 960] [--height 640] [--scale 1] [--scroll-end '<heading>']
                                        size the page to exactly width × height, print the
                                        overflow checks, save a PNG of width·scale × height·scale

  --port <n>   debug port the app was started with (default 9222)`;

export type Command =
  | { kind: 'eval'; expression: string }
  | { kind: 'click'; labels: string[] }
  | { kind: 'scroll-end'; heading: string | undefined }
  | {
      kind: 'shot';
      file: string;
      width: number;
      height: number;
      scale: number;
      scrollEnd: string | undefined;
    };

export interface ParsedArgs {
  port: number;
  command: Command;
}

export type ParseResult = { ok: true; value: ParsedArgs } | { ok: false; error: string };

function positiveNumber(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new RangeError(`--${name} must be a positive number`);
  return n;
}

/** Parses the CLI's arguments (after the script name) into one command. */
export function parseUiArgs(argv: readonly string[]): ParseResult {
  try {
    const { values, positionals } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        port: { type: 'string' },
        width: { type: 'string' },
        height: { type: 'string' },
        scale: { type: 'string' },
        'scroll-end': { type: 'string' },
      },
    });
    const port = positiveNumber(values.port, 9222, 'port');
    const [name, ...rest] = positionals;
    const ok = (command: Command): ParseResult => ({ ok: true, value: { port, command } });
    switch (name) {
      case 'eval':
        return rest.length === 1 && rest[0]
          ? ok({ kind: 'eval', expression: rest[0] })
          : { ok: false, error: 'eval takes one expression' };
      case 'click':
        return rest.length > 0
          ? ok({ kind: 'click', labels: rest })
          : { ok: false, error: 'click takes at least one label' };
      case 'scroll-end':
        return rest.length <= 1
          ? ok({ kind: 'scroll-end', heading: rest[0] })
          : { ok: false, error: 'scroll-end takes at most one heading' };
      case 'shot':
        return rest.length === 1 && rest[0]
          ? ok({
              kind: 'shot',
              file: rest[0],
              width: positiveNumber(values.width, 960, 'width'),
              height: positiveNumber(values.height, 640, 'height'),
              scale: positiveNumber(values.scale, 1, 'scale'),
              scrollEnd: values['scroll-end'],
            })
          : { ok: false, error: 'shot takes one file path' };
      default:
        return { ok: false, error: name ? `Unknown command: ${name}` : 'No command' };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
