import type { Logger, RoastRecorder, RoastRepository } from '@roastpilot/core';
import { IPC_CHANNELS, type IpcEventChannel, type IpcEventPayloads } from '@roastpilot/shared';
import type { BeanService } from './beans/bean-service';
import { HistoryService } from './history/history-service';
import { RoastFileService } from './history/roast-file-service';
import type { RoasterService } from './roasters/roaster-service';

/** History and roast files on the saved roasts, with bean and roaster names (docs/spec/ui.md). */
export function createHistory({
  roasts,
  beans,
  roasters,
  recorder,
  nowIso,
  refreshBeans,
  publish,
  logger,
}: {
  roasts: RoastRepository;
  beans: Pick<BeanService, 'list' | 'setup' | 'setSetup'>;
  roasters: Pick<RoasterService, 'all'>;
  recorder: Pick<RoastRecorder, 'isRecording' | 'forget'>;
  nowIso: () => string;
  refreshBeans: () => void;
  publish: <C extends IpcEventChannel>(channel: C, payload: IpcEventPayloads[C]) => void;
  logger: Logger;
}): { history: HistoryService; roastFiles: RoastFileService } {
  const beanNames = async () => new Map((await beans.list()).map((bean) => [bean.id, bean.name]));
  return {
    roastFiles: new RoastFileService({
      repository: roasts,
      names: async () => ({
        beans: await beanNames(),
        roasters: new Map(roasters.all.map((roaster) => [roaster.id, roaster.name])),
      }),
      onAdded: (id) => {
        publish(IPC_CHANNELS.roastsChanged, { id, deleted: false });
      },
      now: () => new Date(nowIso()),
      logger,
    }),
    history: new HistoryService({
      repository: roasts,
      beanNames,
      isRecording: (id) => recorder.isRecording(id),
      onDeleted: (id) => {
        recorder.forget(id);
        publish(IPC_CHANNELS.roastsChanged, { id, deleted: true });
        // The next roast's row points at its ghost, which has to exist.
        if (beans.setup.ghostRoastId === id) beans.setSetup({ ...beans.setup, ghostRoastId: null });
      },
      onResultSaved: (id) => {
        publish(IPC_CHANNELS.roastsChanged, { id, deleted: false });
        refreshBeans();
      },
      logger,
    }),
  };
}
