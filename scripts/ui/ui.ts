// CLI: drive and screenshot the running Roastpilot app (usage in args.ts and the ui-check skill).
// Run with: pnpm ui <command> …
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseUiArgs, USAGE, type Command } from './args.ts';
import { connect, evaluate, type CdpSession } from './cdp.ts';
import { clickByText, measureOverflow, scrollToEnd } from './page-scripts.ts';

const SETTLE_MS = 400;

const print = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 1)}\n`);
};

async function shot(session: CdpSession, command: Extract<Command, { kind: 'shot' }>) {
  // The size override lasts as long as this connection, so measure and shoot in it.
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: command.width,
    height: command.height,
    deviceScaleFactor: command.scale,
    mobile: false,
  });
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  if (command.scrollEnd !== undefined)
    print(await evaluate(session, scrollToEnd(command.scrollEnd)));
  print(await evaluate(session, measureOverflow));
  const { data } = await session.send<{ data: string }>('Page.captureScreenshot', {
    format: 'png',
  });
  const file = resolve(command.file);
  writeFileSync(file, Buffer.from(data, 'base64'));
  print({
    saved: file,
    pixels: `${command.width * command.scale}x${command.height * command.scale}`,
  });
}

async function run(session: CdpSession, command: Command): Promise<void> {
  switch (command.kind) {
    case 'eval':
      print(await evaluate(session, command.expression));
      return;
    case 'click':
      print(await evaluate(session, clickByText(command.labels)));
      return;
    case 'scroll-end':
      print(await evaluate(session, scrollToEnd(command.heading)));
      return;
    case 'shot':
      await shot(session, command);
      return;
  }
}

const parsed = parseUiArgs(process.argv.slice(2));
if (!parsed.ok) {
  process.stderr.write(`${parsed.error}\n\n${USAGE}\n`);
  process.exit(1);
}
const session = await connect(parsed.value.port).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
try {
  await run(session, parsed.value.command);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  session.close();
}
