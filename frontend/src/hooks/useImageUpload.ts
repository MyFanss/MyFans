'use client';

import { useCallback } from 'react';
import { uploadFile, UploadOptions } from '@/lib/upload-utils';

/**
 * Hook for handling image uploads with progress tracking
 * Usage:
 *   const { upload } = useImageUpload();
 *   <ImageUpload onUpload={upload} />
 */
export function useImageUpload(options?: UploadOptions) {
  const upload = useCallback(
    async (file: File, signal: AbortSignal, onProgress?: (progress: number) => void) => {
      return uploadFile(file, signal, onProgress, options);
    },
    [options]
  );

  return { upload };
}
