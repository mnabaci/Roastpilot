import type { AlertBannerProps } from '@roastpilot/ui';

interface SafetyCopy {
  kind: AlertBannerProps['kind'];
  text: string;
}

/** One line per safety rule (docs/spec/safety.md): what happened, then what the app did. */
const COPY: Readonly<Record<string, SafetyCopy>> = {
  'emergency-stop': {
    kind: 'critical',
    text: 'Emergency stop · heater off, fan and cooling on',
  },
  'max-temperature': { kind: 'critical', text: 'Too hot · heater off, fan and cooling on' },
  'max-roast-time': {
    kind: 'critical',
    text: 'Roast too long · heater off, fan and cooling on',
  },
  'lost-connection': {
    kind: 'critical',
    text: 'No readings · heater off. Check the roaster and cable',
  },
  'slow-rise': { kind: 'warning', text: 'Temperature barely rising · check the roaster' },
  'frozen-reading': { kind: 'warning', text: 'Same reading for 10 s · check the probe' },
};

/** A rule with no copy yet still gets a banner, never silence. */
export function safetyCopy(rule: string): SafetyCopy {
  return COPY[rule] ?? { kind: 'critical', text: `Safety rule ${rule} tripped` };
}
