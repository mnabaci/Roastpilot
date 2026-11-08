import { App } from '../renderer/src/app/App';
import type { AppDeps } from '../renderer/src/app/app-context';
import { AppProvider } from '../renderer/src/app/AppProvider';

/** The whole app window, as `main.tsx` mounts it, on a scene's deps. */
export function SceneApp({ deps }: { deps: AppDeps }) {
  return (
    <AppProvider deps={deps}>
      <App />
    </AppProvider>
  );
}
