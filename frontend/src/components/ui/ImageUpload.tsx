'use client';

import React, { useState, useRef, useCallback } from 'react';

interface UploadFile {
  file: File;
  progress: number;
  error?: string;
  abortController?: AbortController;
}

export interface ImageUploadProps {
  label: string;
  onUpload: (file: File, signal: AbortSignal, onProgress?: (progress: number) => void) => Promise<void>;
  maxSize?: number;
  acceptedTypes?: string[];
  hint?: string;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageUpload({
  label,
  onUpload,
  maxSize = DEFAULT_MAX_SIZE,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  hint,
  disabled = false,
  className = '',
}: ImageUploadProps) {
  const [uploads, setUploads] = useState<Map<string, UploadFile>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMapRef = useRef<Map<string, UploadFile>>(uploads);
  const componentId = React.useId();

  React.useEffect(() => {
    uploadMapRef.current = uploads;
  }, [uploads]);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!acceptedTypes.includes(file.type)) {
        return `Invalid format. Accepted: ${acceptedTypes.map((t) => t.split('/')[1]).join(', ').toUpperCase()}`;
      }
      if (file.size > maxSize) {
        return `File exceeds ${formatFileSize(maxSize)}`;
      }
      return null;
    },
    [acceptedTypes, maxSize]
  );

  const handleUploadFile = useCallback(
    async (file: File) => {
      const fileId = `${file.name}-${Date.now()}`;
      const abortController = new AbortController();

      setUploads((prev) => {
        const next = new Map(prev);
        next.set(fileId, { file, progress: 0, abortController });
        return next;
      });

      const validationError = validateFile(file);
      if (validationError) {
        setUploads((prev) => {
          const next = new Map(prev);
          const item = next.get(fileId);
          if (item) item.error = validationError;
          return next;
        });
        return;
      }

      try {
        const onProgress = (progress: number) => {
          setUploads((prev) => {
            const next = new Map(prev);
            const item = next.get(fileId);
            if (item) item.progress = progress;
            return next;
          });
        };

        await onUpload(file, abortController.signal, onProgress);
        setUploads((prev) => {
          const next = new Map(prev);
          next.delete(fileId);
          return next;
        });
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setUploads((prev) => {
            const next = new Map(prev);
            const item = next.get(fileId);
            if (item) item.error = err.message || 'Upload failed';
            return next;
          });
        } else if (err instanceof Error && err.name === 'AbortError') {
          setUploads((prev) => {
            const next = new Map(prev);
            next.delete(fileId);
            return next;
          });
        }
      }
    },
    [validateFile, onUpload]
  );

  const handleCancel = useCallback((fileId: string) => {
    const item = uploadMapRef.current.get(fileId);
    if (item?.abortController) {
      item.abortController.abort();
    }
    setUploads((prev) => {
      const next = new Map(prev);
      next.delete(fileId);
      return next;
    });
  }, []);

  const handleRetry = useCallback((fileId: string) => {
    const item = uploadMapRef.current.get(fileId);
    if (item) {
      setUploads((prev) => {
        const next = new Map(prev);
        next.delete(fileId);
        return next;
      });
      handleUploadFile(item.file);
    }
  }, [handleUploadFile]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        acceptedTypes.includes(file.type)
      );

      files.forEach(handleUploadFile);
    },
    [disabled, acceptedTypes, handleUploadFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      files.forEach(handleUploadFile);
      e.target.value = '';
    },
    [handleUploadFile]
  );

  const hasUploads = uploads.size > 0;
  const acceptString = acceptedTypes.join(',');

  return (
    <div className={className}>
      <label htmlFor={`upload-${componentId}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        aria-disabled={disabled}
        className={`
          flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center
          transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'}
        `}
      >
        <input
          ref={inputRef}
          id={`upload-${componentId}`}
          type="file"
          accept={acceptString}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only"
        />
        <svg className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Drag and drop or <span className="text-blue-600 dark:text-blue-400 font-medium">browse</span>
        </span>
        {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</p>}
      </div>

      {hasUploads && (
        <div className="mt-4 space-y-3">
          {Array.from(uploads.entries()).map(([fileId, upload]) => (
            <div key={fileId} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-900/5 dark:bg-white/5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {upload.file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(upload.file.size)}
                  </p>
                </div>
                {upload.error ? (
                  <span className="ml-2 text-xs font-semibold text-red-600 dark:text-red-400">ERROR</span>
                ) : upload.progress === 100 ? (
                  <span className="ml-2 text-xs font-semibold text-green-600 dark:text-green-400">✓</span>
                ) : null}
              </div>

              {!upload.error ? (
                <>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400">{upload.progress}%</p>
                    {upload.progress < 100 && (
                      <button
                        onClick={() => handleCancel(fileId)}
                        className="text-xs text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        type="button"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-red-600 dark:text-red-400">{upload.error}</p>
                  <button
                    onClick={() => handleRetry(fileId)}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                    type="button"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
