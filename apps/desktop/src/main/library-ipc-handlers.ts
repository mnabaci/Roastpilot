import {
  AddStockSchema,
  AdjustStockSchema,
  AutoProfileSchema,
  BeanFieldsSchema,
  BeanIdSchema,
  ConnectTargetSchema,
  CopyProfileRequestSchema,
  DeleteProfilesRequestSchema,
  MakeBeanProfileRequestSchema,
  MilestonesSchema,
  NewRoasterSchema,
  ProfileIdSchema,
  RoasterIdSchema,
  RoasterSchema,
  SaveWiringRequestSchema,
  SetArchivedSchema,
  UpdateBeanSchema,
  IPC_CHANNELS,
} from '@roastpilot/shared';
import type { IpcDeps, IpcHandlers } from './ipc-deps';
import { handler } from './ipc-handler';

/** The Profiles screen's channels. */
export function profileIpcHandlers({
  profiles,
}: Pick<IpcDeps, 'profiles'>): Pick<
  IpcHandlers,
  (typeof IPC_CHANNELS)[
    | 'listProfiles'
    | 'duplicateProfile'
    | 'saveProfile'
    | 'deleteProfile'
    | 'deleteProfiles'
    | 'copyProfile'
    | 'makeProfileFromMilestones']
> {
  return {
    [IPC_CHANNELS.listProfiles]: handler(() => profiles.list()),
    [IPC_CHANNELS.duplicateProfile]: handler((payload) =>
      profiles.duplicate(ProfileIdSchema.parse(payload)),
    ),
    [IPC_CHANNELS.saveProfile]: handler((payload) =>
      profiles.save(AutoProfileSchema.parse(payload)),
    ),
    [IPC_CHANNELS.deleteProfile]: handler((payload) =>
      profiles.delete(ProfileIdSchema.parse(payload)),
    ),
    [IPC_CHANNELS.deleteProfiles]: handler((payload) =>
      profiles.deleteMany(DeleteProfilesRequestSchema.parse(payload)),
    ),
    [IPC_CHANNELS.copyProfile]: handler((payload) => {
      const { id, roasterId } = CopyProfileRequestSchema.parse(payload);
      return profiles.copyTo(id, roasterId);
    }),
    [IPC_CHANNELS.makeProfileFromMilestones]: handler((payload) =>
      profiles.fromMilestones(MilestonesSchema.parse(payload)),
    ),
  };
}

/** The Beans screen's channels: beans and their stock. */
export function beanIpcHandlers({
  beans,
  openBeanLink,
  makeBeanProfile,
}: Pick<IpcDeps, 'beans' | 'openBeanLink' | 'makeBeanProfile'>): Pick<
  IpcHandlers,
  (typeof IPC_CHANNELS)[
    | 'listBeans'
    | 'addBean'
    | 'updateBean'
    | 'setBeanArchived'
    | 'openBeanLink'
    | 'addStock'
    | 'adjustStock'
    | 'stockHistory'
    | 'makeBeanProfile']
> {
  return {
    [IPC_CHANNELS.listBeans]: handler(() => beans.list()),
    [IPC_CHANNELS.addBean]: handler((payload) => beans.add(BeanFieldsSchema.parse(payload))),
    [IPC_CHANNELS.updateBean]: handler((payload) => beans.update(UpdateBeanSchema.parse(payload))),
    [IPC_CHANNELS.setBeanArchived]: handler((payload) =>
      beans.setArchived(SetArchivedSchema.parse(payload)),
    ),
    [IPC_CHANNELS.openBeanLink]: handler((payload) => openBeanLink(BeanIdSchema.parse(payload))),
    [IPC_CHANNELS.addStock]: handler((payload) => beans.addStock(AddStockSchema.parse(payload))),
    [IPC_CHANNELS.adjustStock]: handler((payload) =>
      beans.adjustStock(AdjustStockSchema.parse(payload)),
    ),
    [IPC_CHANNELS.stockHistory]: handler((payload) =>
      beans.stockHistory(BeanIdSchema.parse(payload)),
    ),
    [IPC_CHANNELS.makeBeanProfile]: handler((payload) =>
      makeBeanProfile(MakeBeanProfileRequestSchema.parse(payload)),
    ),
  };
}

/** The Roasters screen's channels: the records, and a TC4's wiring and inputs. */
export function roasterIpcHandlers({
  roasters,
  tc4,
}: Pick<IpcDeps, 'roasters' | 'tc4'>): Pick<
  IpcHandlers,
  (typeof IPC_CHANNELS)[
    | 'listRoasters'
    | 'addRoaster'
    | 'saveRoaster'
    | 'deleteRoaster'
    | 'setActiveRoaster'
    | 'chooseConnection'
    | 'saveRoasterWiring'
    | 'readRoasterInputs']
> {
  return {
    [IPC_CHANNELS.listRoasters]: handler(() => roasters.load()),
    [IPC_CHANNELS.addRoaster]: handler((payload) => roasters.add(NewRoasterSchema.parse(payload))),
    [IPC_CHANNELS.saveRoaster]: handler((payload) => roasters.save(RoasterSchema.parse(payload))),
    [IPC_CHANNELS.deleteRoaster]: handler((payload) =>
      roasters.delete(RoasterIdSchema.parse(payload)),
    ),
    [IPC_CHANNELS.setActiveRoaster]: handler((payload) =>
      roasters.setActive(RoasterIdSchema.parse(payload)),
    ),
    [IPC_CHANNELS.chooseConnection]: handler((payload) =>
      roasters.chooseConnection(ConnectTargetSchema.parse(payload)),
    ),
    [IPC_CHANNELS.saveRoasterWiring]: handler((payload) =>
      tc4.saveWiring(SaveWiringRequestSchema.parse(payload)),
    ),
    [IPC_CHANNELS.readRoasterInputs]: handler(() => tc4.readInputs()),
  };
}
