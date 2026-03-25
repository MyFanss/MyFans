import { useCallback, useRef } from 'react';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export function useUploadProgress() {
  const progressRef = useRef<(progress: UploadProgress) => void>();

  const uploadWithProgress = useCallback(
    async (file: File, onProgress?: (progress: UploadProgress) => void): Promise<void> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        progressRef.current = onProgress;

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            const percentage = Math.round((e.loaded / e.total) * 100);
            onProgress({
              loaded: e.loaded,
              total: e.total,
              percentage,
            });
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        xhr.open('POST', '/api/upload');
        const formData = new FormData();
        formData.append('file', file);
        xhr.send(formData);
      });
    },
    []
  );

  return { uploadWithProgress };
}
