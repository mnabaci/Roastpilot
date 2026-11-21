import { err, ok, type RoastDetail, type RoastpilotApi, type TasteTag } from '@roastpilot/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { BEAN } from '../../test/beans';
import { ACCEPTED_SETTINGS, fakeApi, renderApp } from '../../test/render-app';
import { WORDS_AND_SHEETS, withKey } from '../../test/ai-providers';
import { STEPS } from '../../test/profiles';
import { RoastDetailsCard } from './RoastDetailsCard';

const roast = (id: number, over: Partial<RoastDetail> = {}): RoastDetail => ({
  id,
  startedAt: '2026-11-04T14:32:00.000Z',
  endedAt: '2026-11-04T14:50:00.000Z',
  fcTimeS: 480,
  fcTemp: null,
  dropTimeS: 580,
  dropTemp: 205.5,
  roasterId: null,
  beanId: BEAN.id,
  ghostRoastId: null,
  batchG: 356,
  roastedG: 305,
  rating: 5,
  isFavourite: false,
  notes: 'Third auto roast curve',
  profileId: null,
  profileName: null,
  imported: false,
  mode: 'manual',
  profile: null,
  samples: [],
  events: [],
  ...over,
});

/** An Auto roast on Light · Steps: first crack 8:00, drop 9:40, development 17 %. */
const auto = (over: Partial<RoastDetail> = {}) =>
  roast(1, { mode: 'auto', profile: STEPS, profileId: STEPS.id, ...over });

const AI_ON = { ...ACCEPTED_SETTINGS, ai: { enabled: true, tasteProvider: null } };
const PROVIDERS = [withKey(WORDS_AND_SHEETS, '1234')];

describe('RoastDetailsCard', () => {
  it('opens by default with the bean, weights, rating and notes', () => {
    renderApp(<RoastDetailsCard roast={roast(1)} report={undefined} beans={[BEAN]} live={false} />);
    expect(screen.getByRole('button', { name: 'Roast details' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /^Bean/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Green')).toHaveValue('356');
    expect(screen.getByRole('group', { name: 'Rating' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('Third auto roast curve');
  });

  it('folds to one line, and saves that choice for every roast', async () => {
    const { api, stores } = renderApp(
      <RoastDetailsCard roast={roast(1)} report={undefined} beans={[BEAN]} live={false} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Roast details' }));
    const header = screen.getByRole('button', { name: 'Roast details' });
    expect(header).toHaveTextContent(
      `${BEAN.name} · 356 → 305 g · 14.3 % · ★★★★★ · Third auto roast curve`,
    );
    expect(header).toHaveAccessibleDescription(
      `${BEAN.name} · 356 → 305 g · 14.3 % · rated 5 of 5 · Third auto roast curve`,
    );
    await waitFor(() => {
      expect(screen.queryByLabelText('Notes')).toBeNull();
    });
    await waitFor(() => {
      expect(api.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({ historyDetailsOpen: false }),
      );
    });
    // One setting, not per roast: every roast opens folded now.
    expect(stores.settings.getState().settings.historyDetailsOpen).toBe(false);
  });

  it('opens folded when the setting says so, as after a restart', () => {
    renderApp(
      <RoastDetailsCard roast={roast(1)} report={undefined} beans={[BEAN]} live={false} />,
      {
        settings: { ...ACCEPTED_SETTINGS, historyDetailsOpen: false },
      },
    );
    expect(screen.getByRole('button', { name: 'Roast details' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('leaves the bean alone on the roast being roasted', () => {
    renderApp(<RoastDetailsCard roast={roast(1)} report={undefined} beans={[BEAN]} live />);
    expect(screen.queryByRole('button', { name: /^Bean/ })).toBeNull();
    expect(screen.getByLabelText('Green')).toBeInTheDocument();
  });

  it('hides taste on the roast being roasted', () => {
    renderApp(<RoastDetailsCard roast={roast(1)} report={undefined} beans={[BEAN]} live />);
    expect(screen.queryByRole('group', { name: 'Taste' })).toBeNull();
  });

  it('folds to a line with the taste tags after the rating', async () => {
    renderApp(
      <RoastDetailsCard
        roast={roast(1, { tasteTags: ['sour', 'thin'] })}
        report={undefined}
        beans={[BEAN]}
        live={false}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Roast details' }));
    expect(screen.getByRole('button', { name: 'Roast details' })).toHaveTextContent(
      '★★★★★ · Sour, Thin · Third auto roast curve',
    );
  });
});

describe('Taste', () => {
  const card = (detail: RoastDetail) => (
    <RoastDetailsCard roast={detail} report={undefined} beans={[BEAN]} live={false} />
  );

  it('saves a tag as you tick it, in the tags’ order, and unticks it again', async () => {
    const { api } = renderApp(card(auto({ tasteTags: ['thin'] })));
    expect(screen.getByRole('button', { name: 'Thin' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Sour' }));
    expect(api.saveRoastTaste).toHaveBeenLastCalledWith({
      id: 1,
      tags: ['sour', 'thin'],
      words: null,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Thin' }));
    expect(api.saveRoastTaste).toHaveBeenLastCalledWith({ id: 1, tags: ['sour'], words: null });
  });

  it('suggests one change in numbers first, and makes the bean’s profile', async () => {
    const { api } = renderApp(card(auto()));
    expect(screen.queryByText(/→/)).toBeNull();
    api.makeTasteProfile.mockResolvedValueOnce(
      ok({ profile: { ...STEPS, id: 'custom-1', name: BEAN.name }, builtIn: false }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sour' }));
    const from = `${String(Math.floor(STEPS.devTimeS / 60))}:${String(STEPS.devTimeS % 60).padStart(2, '0')}`;
    const to = STEPS.devTimeS + 15;
    const toText = `${String(Math.floor(to / 60))}:${String(to % 60).padStart(2, '0')}`;
    expect(screen.getByText(`Development ${from} → ${toText}`)).toBeInTheDocument();
    expect(
      screen.getByText('Sour, grassy or thin often means under-developed'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: `Make ${BEAN.name} profile` }));
    expect(api.makeTasteProfile).toHaveBeenCalledWith({ roastId: 1 });
  });

  it('says why when the profile can’t be made', async () => {
    const { api } = renderApp(card(auto({ tasteTags: ['sour'] })));
    api.makeTasteProfile.mockResolvedValueOnce(err({ kind: 'no-change' }));
    await userEvent.click(screen.getByRole('button', { name: `Make ${BEAN.name} profile` }));
    expect(
      await screen.findByText('Nothing to change any more · the taste changed'),
    ).toBeInTheDocument();
  });

  it('asks for an Auto roast on a manual one, with no button', () => {
    renderApp(card(roast(1, { tasteTags: ['bitter'] })));
    expect(screen.getByText('Roast on Auto to get a suggestion')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Make/ })).toBeNull();
  });

  it('offers the star for sweet and balanced', () => {
    renderApp(card(auto({ tasteTags: ['balanced'] })));
    expect(screen.getByText('Sounds right · star it to roast it again')).toBeInTheDocument();
  });

  it('has no words field while the AI helpers are off', () => {
    renderApp(card(auto()));
    expect(screen.queryByLabelText('In your words')).toBeNull();
  });

  describe('in your words', () => {
    /** The AI helpers on with a Claude key; `readTaste` answers as given. */
    const setup = (answer?: Awaited<ReturnType<RoastpilotApi['readTaste']>>, detail = auto()) => {
      const api = fakeApi({
        listAiProviders: () => Promise.resolve(PROVIDERS),
        ...(answer ? { readTaste: () => Promise.resolve(answer) } : {}),
      });
      return renderApp(card(detail), { settings: AI_ON }, api);
    };

    it('reads the words, ticks what they describe and keeps yours', async () => {
      const { api } = setup(ok(['sour', 'grassy']), auto({ tasteTags: ['flat'] }));
      const field = await screen.findByLabelText('In your words');
      await userEvent.type(field, 'tart, hay');
      await userEvent.click(screen.getByRole('button', { name: 'Read' }));
      expect(api.readTaste).toHaveBeenCalledWith({ words: 'tart, hay' });
      await waitFor(() => {
        expect(api.saveRoastTaste).toHaveBeenLastCalledWith({
          id: 1,
          tags: ['sour', 'grassy', 'flat'],
          words: 'tart, hay',
        });
      });
      expect(screen.getByRole('button', { name: 'Flat' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('keeps a tag you tick while the words are being read', async () => {
      let answer: (tags: TasteTag[]) => void = () => undefined;
      const { api } = renderApp(
        card(auto()),
        { settings: AI_ON },
        fakeApi({
          listAiProviders: () => Promise.resolve(PROVIDERS),
          readTaste: () =>
            new Promise((resolve) => {
              answer = (tags) => {
                resolve(ok(tags));
              };
            }),
        }),
      );
      await userEvent.type(await screen.findByLabelText('In your words'), 'tart');
      await userEvent.click(screen.getByRole('button', { name: 'Read' }));
      await userEvent.click(screen.getByRole('button', { name: 'Bitter' }));
      answer(['sour']);
      await waitFor(() => {
        expect(api.saveRoastTaste).toHaveBeenLastCalledWith({
          id: 1,
          tags: ['sour', 'bitter'],
          words: 'tart',
        });
      });
      expect(screen.getByRole('button', { name: 'Bitter' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('says when the words tick nothing', async () => {
      setup(ok([]));
      await userEvent.type(await screen.findByLabelText('In your words'), 'lovely');
      await userEvent.click(screen.getByRole('button', { name: 'Read' }));
      expect(await screen.findByText('Nothing to tick from those words')).toBeInTheDocument();
    });

    it('says why a read failed, keeping the words', async () => {
      setup(err({ kind: 'offline', provider: 'alpha' }));
      const field = await screen.findByLabelText('In your words');
      await userEvent.type(field, 'tart');
      await userEvent.click(screen.getByRole('button', { name: 'Read' }));
      expect(
        await screen.findByText("Couldn't reach the AI · check your connection"),
      ).toBeInTheDocument();
      expect(field).toHaveValue('tart');
    });

    it('keeps your words when you leave the field, and not again when unchanged', async () => {
      const { api } = setup();
      const field = await screen.findByLabelText('In your words');
      await userEvent.type(field, 'tart');
      await userEvent.tab();
      expect(api.saveRoastTaste).toHaveBeenCalledTimes(1);
      expect(api.saveRoastTaste).toHaveBeenLastCalledWith({ id: 1, tags: [], words: 'tart' });
      await userEvent.click(field);
      await userEvent.tab();
      expect(api.saveRoastTaste).toHaveBeenCalledTimes(1);
    });

    it('waits on Read while the field is empty', async () => {
      setup();
      expect(await screen.findByRole('button', { name: 'Read' })).toBeDisabled();
    });
  });
});
