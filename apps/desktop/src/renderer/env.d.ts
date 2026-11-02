import type { RoastpilotApi } from '@roastpilot/shared';

declare global {
  interface Window {
    roastpilot: RoastpilotApi;
  }
}
