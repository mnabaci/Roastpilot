import { useStore } from 'zustand';
import type { ConnectionState, Settings } from '@roastpilot/shared';
import { useDeps } from '../app/app-context';
import type { RoastData } from './roast-store';
import type { SafetyState } from './safety-store';

// One hook per store: a component re-renders only when the value it selects changes.

export const useSync = <T>(select: (state: { ready: boolean }) => T): T =>
  useStore(useDeps().stores.sync, select);

export const useConnection = <T>(select: (state: { connection: ConnectionState }) => T): T =>
  useStore(useDeps().stores.connection, select);

export const useRoast = <T>(select: (state: RoastData) => T): T =>
  useStore(useDeps().stores.roast, select);

export const useSafety = <T>(select: (state: SafetyState) => T): T =>
  useStore(useDeps().stores.safety, select);

export const useSettings = <T>(select: (state: { settings: Settings }) => T): T =>
  useStore(useDeps().stores.settings, select);
