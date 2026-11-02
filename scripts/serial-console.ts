// Milestone 1 (docs/spec/build-order.md): lists serial ports, opens one at 115200 baud, sends
// UNITS;C and polls READ every second, and lets you type raw commands. Every line sent and
// received is appended to logs/serial-sessions/<timestamp>.jsonl as a dataset for the simulator.
//
// Run with: node scripts/serial-console.ts [--port /dev/cu.usbmodemXXXX]
import { createWriteStream, mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { ReadlineParser, SerialPort } from 'serialport';

const BAUD_RATE = 115200;
const POLL_INTERVAL_MS = 1000;
const COMMAND_GAP_MS = 150;
const SAFE_STOP_COMMANDS = ['OT1;0', 'OT2;100', 'COOL;100'];

interface LogEntry {
  timestamp: string;
  direction: 'tx' | 'rx';
  text: string;
}

// `serialport`'s own types resolve SerialPort.list() to any[]: @serialport/bindings-interface,
// which declares PortInfo, isn't a direct dependency of `serialport`, so pnpm's strict
// node_modules can't resolve it. Typed here instead of trusting the upstream `any`.
interface PortInfo {
  path: string;
  manufacturer: string | undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pickPort(requested: string | undefined): Promise<string> {
  const ports = (await SerialPort.list()) as PortInfo[];
  if (requested) {
    if (!ports.some((port) => port.path === requested)) {
      const available = ports.map((port) => port.path).join(', ') || '(none)';
      throw new Error(`Port ${requested} not found. Available: ${available}`);
    }
    return requested;
  }
  if (ports.length === 0) {
    throw new Error('No serial ports found. Plug in the Arduino and try again.');
  }
  const [onlyPort] = ports;
  if (ports.length === 1 && onlyPort) {
    console.log(`Using the only port found: ${onlyPort.path}`);
    return onlyPort.path;
  }
  console.log('Available ports:');
  ports.forEach((port, i) => {
    console.log(`  ${i}: ${port.path}${port.manufacturer ? ` (${port.manufacturer})` : ''}`);
  });
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer: string = await new Promise((resolve) => {
    rl.question('Pick a port by number: ', resolve);
  });
  rl.close();
  const chosen = ports[Number.parseInt(answer, 10)];
  if (!chosen) throw new Error(`No port at index ${answer}`);
  return chosen.path;
}

/** Sends one line at a time, spaced by COMMAND_GAP_MS so the sketch never merges two commands. */
class CommandQueue {
  private readonly pending: string[] = [];
  private draining = false;
  private readonly send: (line: string) => void;

  constructor(send: (line: string) => void) {
    this.send = send;
  }

  push(line: string): void {
    this.pending.push(line);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    let next: string | undefined;
    while ((next = this.pending.shift()) !== undefined) {
      this.send(next);
      await delay(COMMAND_GAP_MS);
    }
    this.draining = false;
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { port: { type: 'string' } } });
  const path = await pickPort(values.port);

  mkdirSync('logs/serial-sessions', { recursive: true });
  const logPath = `logs/serial-sessions/${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
  const log = createWriteStream(logPath, { flags: 'a' });
  const record = (entry: LogEntry): void => {
    log.write(`${JSON.stringify(entry)}\n`);
  };

  console.log('Roastpilot talks to a live heater. Stay with the roaster.');
  console.log(`Opening ${path} at ${BAUD_RATE} baud. Logging to ${logPath}.`);
  console.log('Type a command and press enter to send it. Ctrl+C to safe-stop and quit.\n');

  const port = new SerialPort({ path, baudRate: BAUD_RATE });
  const queue = new CommandQueue((line) => {
    record({ timestamp: new Date().toISOString(), direction: 'tx', text: line });
    console.log(`> ${line}`);
    port.write(`${line}\n`);
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
  parser.on('data', (line: string) => {
    const text = line.trim();
    record({ timestamp: new Date().toISOString(), direction: 'rx', text });
    console.log(`< ${text}`);
  });
  port.on('error', (err: Error) => {
    console.error(`Serial error: ${err.message}`);
  });

  let pollTimer: NodeJS.Timeout | undefined;
  port.on('open', () => {
    if (pollTimer) clearInterval(pollTimer);
    queue.push('UNITS;C');
    queue.push('READ');
    pollTimer = setInterval(() => {
      queue.push('READ');
    }, POLL_INTERVAL_MS);
  });

  const stdin = createInterface({ input: process.stdin });
  stdin.on('line', (line) => {
    const command = line.trim();
    if (command) queue.push(command);
  });

  const shutdown = async (): Promise<void> => {
    console.log('\nSafe-stopping...');
    if (pollTimer) clearInterval(pollTimer);
    stdin.close();
    for (const command of SAFE_STOP_COMMANDS) {
      queue.push(command);
    }
    await delay(SAFE_STOP_COMMANDS.length * COMMAND_GAP_MS + COMMAND_GAP_MS);
    await new Promise<void>((resolve) => {
      port.close(() => {
        resolve();
      });
    });
    log.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
}

await main();
