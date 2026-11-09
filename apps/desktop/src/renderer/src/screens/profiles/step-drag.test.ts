import type { Modifier } from '@dnd-kit/core';
import { describe, expect, it } from 'vitest';
import type { StepDraft } from './profile-draft';
import { dropMove, keepInTable, keepStepIds, slideFor, sortableIds } from './step-drag';

const step = (name: string): StepDraft => ({
  name,
  endC: '',
  time: '',
  rorMin: '',
  rorMax: '',
  heat: '',
  fan: '',
  backup: '',
});

describe('keepStepIds', () => {
  const counter = () => {
    let n = 0;
    return () => `s${String(++n)}`;
  };

  it('gives every step a new id the first time', () => {
    expect(keepStepIds({ steps: [], ids: [] }, [step('a'), step('b')], counter())).toEqual([
      's1',
      's2',
    ]);
  });

  it('a moved step keeps its id', () => {
    const [a, b, c] = [step('a'), step('b'), step('c')];
    const before = { steps: [a, b, c], ids: ['1', '2', '3'] };
    expect(keepStepIds(before, [b, a, c], counter())).toEqual(['2', '1', '3']);
  });

  it('an edited step (a new object) keeps the id of its place', () => {
    const [a, b] = [step('a'), step('b')];
    const before = { steps: [a, b], ids: ['1', '2'] };
    expect(keepStepIds(before, [a, { ...b, heat: '50' }], counter())).toEqual(['1', '2']);
  });

  it('an added step gets a new id; a removed one takes its id with it', () => {
    const [a, b, c] = [step('a'), step('b'), step('c')];
    const before = { steps: [a, b, c], ids: ['1', '2', '3'] };
    expect(keepStepIds(before, [a, c], counter())).toEqual(['1', '3']);
    expect(keepStepIds(before, [a, b, c, step('d')], counter())).toEqual(['1', '2', '3', 's1']);
  });

  it('never hands out one id twice', () => {
    const a = step('a');
    const before = { steps: [a, step('b')], ids: ['1', '2'] };
    expect(keepStepIds(before, [a, a], counter())).toEqual(['1', '2']);
  });
});

describe('sortableIds', () => {
  it('leaves out the last step, which ends the roast', () => {
    expect(sortableIds(['1', '2', '3'])).toEqual(['1', '2']);
    expect(sortableIds(['1'])).toEqual([]);
  });
});

describe('dropMove', () => {
  const ids = ['1', '2', '3', '4'];

  it('turns a drop on another movable step into a move', () => {
    expect(dropMove(ids, '3', '1')).toEqual({ from: 2, to: 0 });
    expect(dropMove(ids, '1', '3')).toEqual({ from: 0, to: 2 });
  });

  it('nothing to do when dropped in place or on nothing', () => {
    expect(dropMove(ids, '2', '2')).toBeUndefined();
    expect(dropMove(ids, '2', undefined)).toBeUndefined();
  });

  it('the last step is neither carried nor a place to drop', () => {
    expect(dropMove(ids, '4', '1')).toBeUndefined();
    expect(dropMove(ids, '1', '4')).toBeUndefined();
  });

  it('an unknown id moves nothing', () => {
    expect(dropMove(ids, 'x', '1')).toBeUndefined();
    expect(dropMove(ids, '1', 'x')).toBeUndefined();
  });
});

describe('keepInTable', () => {
  const rect = (top: number, height: number) => ({
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 800,
    width: 800,
  });
  const args = (y: number, x = 30) =>
    ({
      transform: { x, y, scaleX: 1, scaleY: 1 },
      draggingNodeRect: rect(100, 40),
      containerNodeRect: rect(20, 300),
    }) as unknown as Parameters<Modifier>[0];

  it('moves up and down only', () => {
    expect(keepInTable(args(10))).toMatchObject({ x: 0, y: 10 });
  });

  it('stays inside the table', () => {
    expect(keepInTable(args(-500))).toMatchObject({ y: -80 });
    expect(keepInTable(args(500))).toMatchObject({ y: 180 });
  });

  it('without the rects, still up and down only', () => {
    const bare = { transform: { x: 9, y: 9, scaleX: 1, scaleY: 1 } };
    expect(keepInTable(bare as unknown as Parameters<Modifier>[0])).toMatchObject({ x: 0, y: 9 });
  });
});

describe('slideFor', () => {
  it('slides the rows out of the way in 150 ms', () => {
    expect(slideFor(false)).toEqual({ duration: 150, easing: 'ease' });
  });

  it('with reduced motion they jump: no slide', () => {
    expect(slideFor(true)).toBeNull();
  });
});
