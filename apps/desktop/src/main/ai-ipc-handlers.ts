import {
  AiProviderSchema,
  IPC_CHANNELS,
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
  | typeof IPC_CHANNELS.getAiKeys
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
    [IPC_CHANNELS.getAiKeys]: handler(() => ai.keys.status()),
    [IPC_CHANNELS.saveAiKey]: handler((payload) => {
      const { provider, key } = SaveAiKeyRequestSchema.parse(payload);
      return ai.keys.save(provider, key);
    }),
    [IPC_CHANNELS.removeAiKey]: handler((payload) =>
      ai.keys.remove(AiProviderSchema.parse(payload)),
    ),
    [IPC_CHANNELS.readTaste]: handler((payload) =>
      ai.reads.readTaste(ReadTasteRequestSchema.parse(payload).words),
    ),
    [IPC_CHANNELS.readSpecSheet]: handler((payload, { window }) =>
      ai.reads.readSpecSheet(ReadSpecSheetRequestSchema.parse(payload), window),
    ),
  };
}
