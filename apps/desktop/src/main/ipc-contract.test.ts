import {
  IPC_CHANNELS,
  ok,
  type ConnectTarget,
  type InvokeChannel,
  type Roaster,
  type RoastpilotApi,
} from '@roastpilot/shared';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { IpcHandler, IpcHandlers } from './ipc-handlers';

// These tests are mostly for tsc (`pnpm typecheck`): each `@ts-expect-error` fails the build if
// the line under it ever compiles, so they prove the contract catches the mistake.

describe('InvokeContract types', () => {
  it("a handler must answer its channel's result", () => {
    const right: IpcHandler<typeof IPC_CHANNELS.listRoasters> = () =>
      Promise.resolve([] as Roaster[]);
    // @ts-expect-error a number is not the roaster list the renderer expects
    const wrong: IpcHandler<typeof IPC_CHANNELS.listRoasters> = () => Promise.resolve(42);
    // @ts-expect-error connect answers a Result, not a bare value
    const bare: IpcHandler<typeof IPC_CHANNELS.connect> = () => Promise.resolve(undefined);
    const result: IpcHandler<typeof IPC_CHANNELS.connect> = () => Promise.resolve(ok(undefined));
    expect([right, wrong, bare, result]).toHaveLength(4);
  });

  it('the handler map has every invoke channel and no other', () => {
    expectTypeOf<keyof IpcHandlers>().toEqualTypeOf<InvokeChannel>();
    // Never called: tsc checks the shapes.
    const shapes = (all: IpcHandlers) => {
      // @ts-expect-error one handler is not the whole map
      const missing: IpcHandlers = { [IPC_CHANNELS.listPorts]: all[IPC_CHANNELS.listPorts] };
      // @ts-expect-error a channel the contract doesn't have
      const extra: IpcHandlers = { ...all, 'roaster:nope': all[IPC_CHANNELS.listPorts] };
      const wrongShape: IpcHandlers = {
        ...all,
        // @ts-expect-error the roaster list answered with the ports
        [IPC_CHANNELS.listRoasters]: all[IPC_CHANNELS.listPorts],
      };
      return [missing, extra, wrongShape];
    };
    expect(shapes).toBeTypeOf('function');
  });

  it("the renderer's API takes its payloads and results from the contract", () => {
    expectTypeOf<RoastpilotApi['listRoasters']>().toEqualTypeOf<() => Promise<Roaster[]>>();
    expectTypeOf<RoastpilotApi['connect']>().parameter(0).toEqualTypeOf<ConnectTarget>();
    expectTypeOf<RoastpilotApi['disconnect']>().parameters.toEqualTypeOf<[]>();
  });
});
