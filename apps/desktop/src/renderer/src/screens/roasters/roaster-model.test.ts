import { describe, expect, it } from 'vitest';
import { modelNote } from './roaster-model';

describe('modelNote', () => {
  it('says nothing when the name is the model', () => {
    expect(modelNote({ name: 'Skywalker', model: 'skywalker' })).toBeUndefined();
  });

  it('names the model when the name is your own', () => {
    expect(modelNote({ name: 'Cabin roaster', model: 'skywalker' })).toBe('Skywalker');
  });
});
