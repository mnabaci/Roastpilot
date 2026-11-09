import { builderBase } from '@roastpilot/core';
import { Badge, Menu, NavList, SidebarLayout } from '@roastpilot/ui';
import { useState } from 'react';
import { useAuto, useSettings } from '../../stores/use-stores';
import { activeEntry } from '../roast/use-active-profile';
import { MilestoneBuilder } from './MilestoneBuilder';
import { ProfileEditor } from './ProfileEditor';
import { SelectionBar } from '../../features/SelectionBar';
import { useProfileFiles } from './use-profile-files';
import { useProfileSelect } from './use-profile-select';

/** Your profiles and the built-ins, with one open to edit (docs/spec/ui.md, Profiles screen). */
export function ProfilesScreen({ openFirst }: { openFirst?: string | undefined }) {
  const profiles = useAuto((s) => s.profiles);
  const drafts = useAuto((s) => s.drafts);
  const chosenId = useSettings((s) => s.settings.autoProfile);
  const [openId, setOpenId] = useState(openFirst);
  const [building, setBuilding] = useState(false);
  const base = builderBase(profiles.filter((e) => e.builtIn).map((e) => e.profile));
  const open = profiles.find((e) => e.profile.id === openId) ?? activeEntry(profiles, chosenId);
  // The one Auto runs, marked in the list so it shows without opening it.
  const autoId = activeEntry(profiles, chosenId)?.profile.id;
  const files = useProfileFiles((id) => {
    setBuilding(false);
    setOpenId(id);
  });
  // After a delete, the profile Auto uses opens.
  const select = useProfileSelect(profiles, autoId, () => {
    setOpenId(undefined);
  });
  return (
    <SidebarLayout
      title="Profiles"
      contentLabel="Profile"
      titleAction={
        <Menu
          label="More for Profiles"
          items={[
            ...(base
              ? [
                  {
                    label: 'New from milestones',
                    onSelect: () => {
                      setBuilding(true);
                    },
                  },
                ]
              : []),
            {
              label: 'Export all',
              onSelect: () => {
                files.exportFile({ kind: 'profiles' });
              },
            },
            { label: 'Import a Roastpilot file', onSelect: files.importFile },
            { label: 'Select', onSelect: select.start },
          ]}
        />
      }
      sidebar={
        <>
          {select.selecting ? (
            <SelectionBar
              label="Selected profiles"
              count={select.checked.size}
              exportAction={select.exportTicked}
              remove={{
                verb: 'Delete',
                noun: ['profile', 'profiles'],
                detail: 'saved roasts keep their copy',
                onConfirm: select.remove,
              }}
              onDone={select.done}
            />
          ) : null}
          <NavList
            label="Profiles"
            items={profiles.map((entry) => {
              const { profile } = entry;
              const reason = select.selecting ? select.reasonOf(entry) : undefined;
              return {
                id: profile.id,
                label: profile.name,
                ...(reason !== undefined && { detail: reason, locked: true }),
                badge:
                  drafts[profile.id] || profile.id === autoId ? (
                    <span className="flex shrink-0 gap-1">
                      {profile.id === autoId ? <Badge tone="air">Auto</Badge> : null}
                      {drafts[profile.id] ? <Badge tone="heat">Edited</Badge> : null}
                    </span>
                  ) : undefined,
              };
            })}
            openId={building ? undefined : open?.profile.id}
            onOpen={(id) => {
              setBuilding(false);
              setOpenId(id);
            }}
            {...(select.selecting ? { checked: select.checked, onCheck: select.check } : {})}
          />
        </>
      }
    >
      {building && base ? (
        <MilestoneBuilder
          base={base}
          onCreated={(id) => {
            setBuilding(false);
            setOpenId(id);
          }}
          onCancel={() => {
            setBuilding(false);
          }}
        />
      ) : open ? (
        <ProfileEditor key={open.profile.id} entry={open} onSelect={setOpenId} />
      ) : null}
    </SidebarLayout>
  );
}
