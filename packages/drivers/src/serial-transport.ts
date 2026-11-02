import type { Transport, TransportError } from '@roastpilot/core';
import { err, ok, type Result } from '@roastpilot/shared';
import { ReadlineParser, SerialPort, type SerialPortMock } from 'serialport';

type Port = SerialPort | SerialPortMock;

export interface SerialTransportOptions {
  path: string;
  baudRate?: number;
  /** Builds the port, unopened. Tests pass a SerialPortMock. */
  createPort?: (path: string, baudRate: number) => Port;
}

const DEFAULT_BAUD_RATE = 115_200;

function createSerialPort(path: string, baudRate: number): Port {
  return new SerialPort({ path, baudRate, autoOpen: false });
}

function disconnected(error: Error | null | undefined, fallback: string): TransportError {
  return { kind: 'disconnected', message: error?.message ?? fallback };
}

/** Lines over a USB serial port, `\n` terminated. A new port object is made on every open. */
export class SerialTransport implements Transport {
  readonly #path: string;
  readonly #baudRate: number;
  readonly #createPort: (path: string, baudRate: number) => Port;
  readonly #lineListeners: ((line: string) => void)[] = [];
  readonly #closeListeners: (() => void)[] = [];
  #port: Port | undefined;

  constructor(options: SerialTransportOptions) {
    this.#path = options.path;
    this.#baudRate = options.baudRate ?? DEFAULT_BAUD_RATE;
    this.#createPort = options.createPort ?? createSerialPort;
  }

  async open(): Promise<Result<void, TransportError>> {
    await this.close();
    const port = this.#createPort(this.#path, this.#baudRate);
    port.pipe(new ReadlineParser({ delimiter: '\n' })).on('data', (line: string) => {
      const text = line.replace(/\r$/, '');
      for (const listener of this.#lineListeners) listener(text);
    });
    port.on('close', () => {
      if (this.#port === port) this.#port = undefined;
      for (const listener of this.#closeListeners) listener();
    });
    // Errors also surface through open/write callbacks or a close event; this keeps them from crashing the process.
    port.on('error', () => {
      // Ignored on purpose.
    });

    return new Promise((resolve) => {
      port.open((error) => {
        if (error) {
          resolve(err(disconnected(error, 'could not open the port')));
          return;
        }
        this.#port = port;
        resolve(ok(undefined));
      });
    });
  }

  write(line: string): Promise<Result<void, TransportError>> {
    const port = this.#port;
    if (!port?.isOpen) return Promise.resolve(err(disconnected(undefined, 'port is not open')));
    return new Promise((resolve) => {
      port.write(`${line}\n`, (error) => {
        resolve(error ? err(disconnected(error, 'write failed')) : ok(undefined));
      });
    });
  }

  onLine(listener: (line: string) => void): void {
    this.#lineListeners.push(listener);
  }

  onClose(listener: () => void): void {
    this.#closeListeners.push(listener);
  }

  close(): Promise<void> {
    const port = this.#port;
    if (!port?.isOpen) return Promise.resolve();
    return new Promise((resolve) => {
      port.close(() => {
        resolve();
      });
    });
  }
}
