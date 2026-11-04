import { z } from 'zod';
import { ChannelSchema } from './channels';

/** What to connect to (docs/spec/architecture.md, IPC contract). */
export const ConnectTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('serial'), path: z.string().min(1) }),
  z.object({ kind: z.literal('simulator') }),
]);

/** Every state but disconnected says which roaster, so the UI can name it. */
export const ConnectionStateSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('disconnected') }),
  z.object({ status: z.literal('connecting'), target: ConnectTargetSchema }),
  z.object({
    status: z.literal('connected'),
    target: ConnectTargetSchema,
    channels: z.array(ChannelSchema),
  }),
  /** Was connected, no valid reading now; the session keeps trying to reconnect. */
  z.object({ status: z.literal('lost'), target: ConnectTargetSchema }),
]);

export const SerialPortInfoSchema = z.object({
  path: z.string(),
  manufacturer: z.string().optional(),
});

export type ConnectTarget = z.infer<typeof ConnectTargetSchema>;
export type ConnectionState = z.infer<typeof ConnectionStateSchema>;
export type SerialPortInfo = z.infer<typeof SerialPortInfoSchema>;
