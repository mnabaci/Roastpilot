import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render-app';
import { auto, onConnect } from '../../test/roast-screen';
import { RoastScreen } from './RoastScreen';

describe('FlowPanel in Auto', () => {
  it('Charge soon asks main once the hold is over', async () => {
    const { api } = renderApp(
      <RoastScreen onConnect={onConnect} />,
      auto('preheat', { preheatStep: 'add-beans' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Charge soon' }));
    expect(api.autoChargeSoon).toHaveBeenCalledOnce();
  });
});
