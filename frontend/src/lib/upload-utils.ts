/**
 * File upload utilities for handling common upload scenarios
 */

export interface UploadOptions {
  maxSize?: number;
  acceptedTypes?: string[];
  endpoint?: string;
}

const DEFAULT_ENDPOINT = '/api/upload';

/**
 * Upload file with progress tracking
 * Returns a promise that resolves when upload is complete
 */
export async function uploadFile(
  file: File,
  signal: AbortSignal,
  onProgress?: (progress: number) => void,
  options: UploadOptions = {}
): Promise<void> {
  const { endpoint = DEFAULT_ENDPOINT } = options;
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percentage = Math.round((e.loaded / e.total) * 100);
        onProgress(percentage);
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
      reject(Object.assign(new Error('Upload cancelled'), { name: 'AbortError' }));
    });

    signal.addEventListener('abort', () => xhr.abort());

    xhr.open('POST', endpoint);
    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
}

/**
 * Validate file before upload
 */
export function validateFile(
  file: File,
  maxSize: number = 10 * 1024 * 1024,
  acceptedTypes: string[] = ['image/jpeg', 'image/png', 'image/webp']
): string | null {
  if (!acceptedTypes.includes(file.type)) {
    return `Invalid file type. Accepted: ${acceptedTypes.map((t) => t.split('/')[1]).join(', ').toUpperCase()}`;
  }

  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    return `File exceeds ${maxSizeMB}MB limit`;
  }

  return null;
}

/**
 * Format bytes to readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
