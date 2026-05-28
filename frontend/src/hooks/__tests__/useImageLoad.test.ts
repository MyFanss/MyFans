import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useImageLoad } from '../useImageLoad';

describe('useImageLoad', () => {
  it('starts with isLoaded = false', () => {
    const { result } = renderHook(() => useImageLoad());
    expect(result.current.isLoaded).toBe(false);
  });

  it('sets isLoaded to true after onLoad is called', () => {
    const { result } = renderHook(() => useImageLoad());

    act(() => {
      result.current.onLoad();
    });

    expect(result.current.isLoaded).toBe(true);
  });

  it('returns a stable onLoad reference across renders', () => {
    const { result, rerender } = renderHook(() => useImageLoad());
    const firstOnLoad = result.current.onLoad;

    rerender();

    expect(result.current.onLoad).toBe(firstOnLoad);
  });

  it('can be called multiple times without error', () => {
    const { result } = renderHook(() => useImageLoad());

    act(() => {
      result.current.onLoad();
      result.current.onLoad();
    });

    expect(result.current.isLoaded).toBe(true);
  });
});
