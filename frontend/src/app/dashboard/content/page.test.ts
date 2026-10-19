/**
 * Unit tests for the Content library upload reducer — #2014.
 *
 * A failed upload must not leave a stale progress bar or stale form fields
 * visible when the upload form is reopened: SHOW_UPLOAD must reset
 * `upload` back to `emptyUpload` and `uploadProgress` back to null, not
 * just clear `uploadError`.
 */
import { describe, expect, it } from 'vitest';

import { emptyUpload, initialState, reducer, type ContentItem, type Action } from './page';

function item(id: string): ContentItem {
  return { id, title: `Title ${id}`, isGated: false, createdAt: '2026-01-01T00:00:00.000Z' };
}

describe('content page upload reducer', () => {
  it('clears uploadProgress and resets the form after UPLOADING -> UPLOAD_PROGRESS -> UPLOAD_ERROR -> SHOW_UPLOAD', () => {
    let state = initialState;

    state = reducer(state, { type: 'UPLOAD_FIELD', field: 'title', value: 'My post' });
    state = reducer(state, { type: 'UPLOADING' });
    expect(state.uploadProgress).toBe(0);

    state = reducer(state, { type: 'UPLOAD_PROGRESS', pct: 60 });
    expect(state.uploadProgress).toBe(60);
    expect(state.uploading).toBe(true);

    state = reducer(state, { type: 'UPLOAD_ERROR', message: 'Upload failed.' });
    expect(state.uploading).toBe(false);
    expect(state.uploadProgress).toBeNull();
    expect(state.uploadError).toBe('Upload failed.');
    // The failed field values are still present until the form is reopened.
    expect(state.upload.title).toBe('My post');

    state = reducer(state, { type: 'SHOW_UPLOAD' });
    expect(state.uploadProgress).toBeNull();
    expect(state.upload).toEqual(emptyUpload);
    expect(state.uploadError).toBeNull();
    expect(state.showUploadForm).toBe(true);
  });

  it('SHOW_UPLOAD resets stale progress/fields even without a prior error', () => {
    let state = initialState;
    state = reducer(state, { type: 'UPLOAD_FIELD', field: 'title', value: 'Draft' });
    state = reducer(state, { type: 'UPLOADING' });
    state = reducer(state, { type: 'UPLOAD_PROGRESS', pct: 40 });

    state = reducer(state, { type: 'SHOW_UPLOAD' });
    expect(state.uploadProgress).toBeNull();
    expect(state.upload).toEqual(emptyUpload);
  });

  it('UPLOAD_ERROR leaves uploading false and uploadProgress null', () => {
    let state = initialState;
    state = reducer(state, { type: 'UPLOADING' });
    state = reducer(state, { type: 'UPLOAD_PROGRESS', pct: 30 });
    state = reducer(state, { type: 'UPLOAD_ERROR', message: 'boom' });
    expect(state.uploading).toBe(false);
    expect(state.uploadProgress).toBeNull();
  });
});

describe('content dashboard reducer', () => {
  it('ITEMS_LOADED (replace) sets items, cursor and hasMore', () => {
    const state = reducer(initialState, {
      type: 'ITEMS_LOADED',
      items: [item('1'), item('2')],
      cursor: 'cursor-a',
      append: false,
    } as Action);

    expect(state.items.map((i) => i.id)).toEqual(['1', '2']);
    expect(state.itemsLoading).toBe(false);
    expect(state.cursor).toBe('cursor-a');
    expect(state.hasMore).toBe(true);
  });

  it('ITEMS_LOADED with cursor: null sets hasMore to false', () => {
    const state = reducer(initialState, {
      type: 'ITEMS_LOADED',
      items: [item('1')],
      cursor: null,
      append: false,
    } as Action);

    expect(state.hasMore).toBe(false);
    expect(state.cursor).toBeNull();
  });

  it('LOAD_MORE sets itemsLoading without touching existing items', () => {
    const loaded = reducer(initialState, {
      type: 'ITEMS_LOADED',
      items: [item('1')],
      cursor: 'cursor-a',
      append: false,
    } as Action);

    const loading = reducer(loaded, { type: 'LOAD_MORE' } as Action);
    expect(loading.itemsLoading).toBe(true);
    expect(loading.items.map((i) => i.id)).toEqual(['1']);
  });

  it('ITEMS_LOADED with append: true appends without dropping existing items', () => {
    const page1 = reducer(initialState, {
      type: 'ITEMS_LOADED',
      items: [item('1'), item('2')],
      cursor: 'cursor-a',
      append: false,
    } as Action);
    const loading = reducer(page1, { type: 'LOAD_MORE' } as Action);
    const page2 = reducer(loading, {
      type: 'ITEMS_LOADED',
      items: [item('3')],
      cursor: null,
      append: true,
    } as Action);

    expect(page2.items.map((i) => i.id)).toEqual(['1', '2', '3']);
    expect(page2.itemsLoading).toBe(false);
    expect(page2.hasMore).toBe(false);
  });

  it('TOGGLE_DONE updates only the matching item', () => {
    const loaded = reducer(initialState, {
      type: 'ITEMS_LOADED',
      items: [item('1'), item('2')],
      cursor: null,
      append: false,
    } as Action);

    const toggled = reducer(loaded, { type: 'TOGGLE_DONE', id: '2', isGated: true } as Action);
    expect(toggled.items.find((i) => i.id === '2')?.isGated).toBe(true);
    expect(toggled.items.find((i) => i.id === '1')?.isGated).toBe(false);
  });

  it('UPLOAD_DONE prepends the new item and resets the upload form', () => {
    const uploading = reducer(initialState, { type: 'UPLOADING' } as Action);
    const done = reducer(uploading, { type: 'UPLOAD_DONE', item: item('new') } as Action);

    expect(done.items[0].id).toBe('new');
    expect(done.uploading).toBe(false);
    expect(done.showUploadForm).toBe(false);
  });
});
  });
});
