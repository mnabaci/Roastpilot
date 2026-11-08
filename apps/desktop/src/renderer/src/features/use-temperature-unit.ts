import type { TemperatureUnit } from '@roastpilot/shared';
import { useSettings } from '../stores/use-stores';

/**
 * What temperatures are shown and typed in (Settings › Appearance › Temperature): everything is
 * stored in °C and only the screen converts (docs/spec/ui.md, Units). Changes apply at once.
 */
export const useTemperatureUnit = (): TemperatureUnit =>
  useSettings((s) => s.settings.temperatureUnit);
