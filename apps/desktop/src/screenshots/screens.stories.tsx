import type { Meta, StoryObj } from '@storybook/react-vite';
import sampleWorld from 'virtual:sample-world';
import type { AppDeps } from '../renderer/src/app/app-context';
import type { SampleWorld } from './app-state';
import { sceneDeps } from './scene-deps';
import { SceneApp } from './SceneApp';
import { dropFocus, SCENES, type Scene } from './scenes';

/**
 * The README screenshots, one story per scene (`pnpm screenshots` captures them). Each is the
 * whole app on the sample world; `data-scene-ready` on <body> says it is ready to capture.
 */
const meta = { title: 'Screens' } satisfies Meta;

export default meta;

type Story = StoryObj;

// Built by .storybook/sample-world-plugin.ts from buildSampleWorld().
const world = sampleWorld as SampleWorld;

function sceneStory(id: string): Story {
  const scene: Scene | undefined = SCENES.find((s) => s.id === id);
  if (!scene) throw new Error(`No scene ${id}`);
  return {
    loaders: [async () => ({ deps: await sceneDeps(world[scene.moment], scene.screen) })],
    render: (_args, { loaded }) => <SceneApp deps={loaded.deps as AppDeps} />,
    play: async () => {
      delete document.body.dataset.sceneReady;
      await scene.prepare();
      await dropFocus();
      document.body.dataset.sceneReady = scene.id;
    },
  };
}

// Export names give the story ids (`screens--roast-auto`), which name the images.
export const RoastAuto = sceneStory('roast-auto');
export const RoastManual = sceneStory('roast-manual');
export const Profiles = sceneStory('profiles');
export const History = sceneStory('history');
export const Beans = sceneStory('beans');
export const Roasters = sceneStory('roasters');
