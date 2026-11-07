import { describe, expect, it } from 'vitest';
import { BEAN } from '../../test/beans';
import { beanDetail } from './bean-detail';

describe('beanDetail', () => {
  it('reads stock, origin and process', () => {
    expect(beanDetail(BEAN)).toBe('300 g · Ethiopia · washed');
  });
});
