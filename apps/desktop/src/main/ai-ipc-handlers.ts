import {
  AiProviderIdSchema,
  IPC_CHANNELS,
  ok,
  MakeTasteProfileRequestSchema,
  ReadSpecSheetRequestSchema,
  ReadTasteRequestSchema,
  RoastTasteSchema,
  SaveAiKeyRequestSchema,
} from '@roastpilot/shared';
import type { IpcDeps, IpcHandlers } from './ipc-deps';
import { handler } from './ipc-handler';

type TasteChannels =
  | typeof IPC_CHANNELS.saveRoastTaste
  | typeof IPC_CHANNELS.makeTasteProfile
  | typeof IPC_CHANNELS.listAiProviders
  | typeof IPC_CHANNELS.saveAiKey
  | typeof IPC_CHANNELS.removeAiKey
  | typeof IPC_CHANNELS.readTaste
  | typeof IPC_CHANNELS.readSpecSheet;

/** Taste and the AI helpers (docs/spec/ai-helpers.md); every payload checked first. */
export function tasteIpcHandlers({
  history,
  makeTasteProfile,
  ai,
}: Pick<IpcDeps, 'history' | 'makeTasteProfile' | 'ai'>): Pick<IpcHandlers, TasteChannels> {
  return {
    [IPC_CHANNELS.saveRoastTaste]: handler((payload) =>
      history.saveTaste(RoastTasteSchema.parse(payload)),
    ),
    [IPC_CHANNELS.makeTasteProfile]: handler((payload) =>
      makeTasteProfile(MakeTasteProfileRequestSchema.parse(payload)),
    ),
    [IPC_CHANNELS.listAiProviders]: handler(() => ai.reads.list()),
    // A key change answers with the providers as they are now, so Settings shows them at once.
    [IPC_CHANNELS.saveAiKey]: handler(async (payload) => {
      const { provider, key } = SaveAiKeyRequestSchema.parse(payload);
      const saved = await ai.keys.save(provider, key);
      return saved.ok ? ok(await ai.reads.list()) : saved;
    }),
    [IPC_CHANNELS.removeAiKey]: handler(async (payload) => {
      const removed = await ai.keys.remove(AiProviderIdSchema.parse(payload));
      return removed.ok ? ok(await ai.reads.list()) : removed;
    }),
    [IPC_CHANNELS.readTaste]: handler((payload) =>
      ai.reads.readTaste(ReadTasteRequestSchema.parse(payload).words),
    ),
    [IPC_CHANNELS.readSpecSheet]: handler((payload, { window }) =>
      ai.reads.readSpecSheet(ReadSpecSheetRequestSchema.parse(payload), window),
    ),
  };
}
