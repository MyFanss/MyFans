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

  it('sets isLoaded to false when onError is called', () => {
    const { result } = renderHook(() => useImageLoad());

    act(() => {
      result.current.onLoad();
    });

    expect(result.current.isLoaded).toBe(true);

    act(() => {
      result.current.onError();
    });

    expect(result.current.isLoaded).toBe(false);
  });

  it('returns a stable onError reference across renders', () => {
    const { result, rerender } = renderHook(() => useImageLoad());
    const firstOnError = result.current.onError;

    rerender();

    expect(result.current.onError).toBe(firstOnError);
  });

  it('handles load -> error -> load sequence', () => {
    const { result } = renderHook(() => useImageLoad());

    act(() => {
      result.current.onLoad();
    });
    expect(result.current.isLoaded).toBe(true);

    act(() => {
      result.current.onError();
    });
    expect(result.current.isLoaded).toBe(false);

    act(() => {
      result.current.onLoad();
    });
    expect(result.current.isLoaded).toBe(true);
  });
});
