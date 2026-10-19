/**
 * Unit tests for the Content library upload reducer — #2014.
 *
 * A failed upload must not leave a stale progress bar or stale form fields
 * visible when the upload form is reopened: SHOW_UPLOAD must reset
 * `upload` back to `emptyUpload` and `uploadProgress` back to null, not
 * just clear `uploadError`.
 */
import { describe, expect, it } from 'vitest';

import { emptyUpload, initialState, reducer } from './page';

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
