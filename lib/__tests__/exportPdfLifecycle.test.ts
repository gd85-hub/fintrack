import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { createPreparedPdfLifecycle } from '../exportPdfLifecycle';

type Prepared = { filename: string };

const dispose = jest.fn<(prepared: Prepared) => void>();

beforeEach(() => {
  dispose.mockReset();
});

describe('prepared PDF lifecycle', () => {
  test('replaces and disposes a previous prepared report on regeneration', () => {
    const lifecycle = createPreparedPdfLifecycle(dispose);
    const first = { filename: 'fintrack-2026-11.pdf' };
    lifecycle.accept(lifecycle.begin(), first);

    lifecycle.begin();

    expect(dispose).toHaveBeenCalledWith(first);
    expect(lifecycle.current()).toBeNull();
  });

  test('rejects a completed generation after month invalidation', () => {
    const lifecycle = createPreparedPdfLifecycle(dispose);
    const generation = lifecycle.begin();
    lifecycle.invalidate();
    const stale = { filename: 'fintrack-2026-11.pdf' };

    expect(lifecycle.accept(generation, stale)).toBe(false);
    expect(dispose).toHaveBeenCalledWith(stale);
    expect(lifecycle.current()).toBeNull();
  });

  test('keeps the accepted report available for repeated Save actions', () => {
    const lifecycle = createPreparedPdfLifecycle(dispose);
    const prepared = { filename: 'fintrack-2025-12.pdf' };
    expect(lifecycle.accept(lifecycle.begin(), prepared)).toBe(true);

    expect(lifecycle.current()).toBe(prepared);
    expect(lifecycle.current()).toBe(prepared);
    expect(dispose).not.toHaveBeenCalled();
  });
});
