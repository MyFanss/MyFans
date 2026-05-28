'use client';

import React, { useState, useRef, useCallback } from 'react';

export interface AvatarUploadProps {
  /** Current avatar URL or null */
  currentAvatar?: string | null;
  /** User's name for generating initials fallback */
  userName?: string;
  /** Callback when a valid file is selected */
  onFileSelect?: (file: File) => void;
  /** Callback for upload action (can be async) */
  onUpload?: (file: File) => Promise<void>;
  /** Loading state (controlled externally) */
  loading?: boolean;
  /** Error message */
  error?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Maximum file size in bytes (default: 1MB) */
  maxSize?: number;
  /** Accepted file types (default: image/jpeg, image/png) */
  acceptedTypes?: string[];
}

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

/**
 * Generate initials from a name
 */
function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AvatarUpload({
  currentAvatar,
  userName,
  onFileSelect,
  onUpload,
  loading = false,
  error: externalError,
  disabled = false,
  className = '',
  maxSize = MAX_FILE_SIZE,
  acceptedTypes = ACCEPTED_TYPES,
}: AvatarUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [internalError, setInternalError] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const componentId = React.useId();
  const inputId = `avatar-upload-${componentId}`;
  const errorId = `${inputId}-error`;
  const descId = `${inputId}-desc`;

  const error = externalError || internalError;

  /**
   * Validate file type and size
   */
  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    if (!acceptedTypes.includes(file.type)) {
      return `Invalid file type. Please upload JPG or PNG images only.`;
    }

    // Check file size
    if (file.size > maxSize) {
      return `File size exceeds ${formatFileSize(maxSize)}. Please choose a smaller file.`;
    }

    return null;
  }, [acceptedTypes, maxSize]);

  /**
   * Handle file selection
   */
  const handleFileChange = useCallback((file: File | null) => {
    setInternalError('');
    
    if (!file) {
      setPreviewUrl(null);
      setSelectedFile(null);
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setInternalError(validationError);
      setPreviewUrl(null);
      setSelectedFile(null);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    setSelectedFile(file);
    onFileSelect?.(file);
  }, [validateFile, onFileSelect]);

  /**
   * Handle input change
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleFileChange(file);
  };

  /**
   * Handle drag and drop
   */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || loading) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !loading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  /**
   * Handle click to open file picker
   */
  const handleClick = () => {
    if (!disabled && !loading) {
      inputRef.current?.click();
    }
  };

  /**
   * Handle keyboard interaction
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  /**
   * Handle upload button click
   */
  const handleUpload = async () => {
    if (!selectedFile || !onUpload) return;
    
    try {
      await onUpload(selectedFile);
      // Clear preview after successful upload
      setPreviewUrl(null);
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch (err) {
      // Error handling is expected to be done by parent component
      console.error('Upload failed:', err);
    }
  };

  // Determine what to display in the avatar
  const displayUrl = previewUrl || currentAvatar;
  const initials = getInitials(userName);

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={handleInputChange}
        disabled={disabled || loading}
        aria-describedby={`${descId} ${error ? errorId : ''}`}
        aria-invalid={!!error}
        className="sr-only"
      />

      {/* Avatar preview and upload area */}
      <div className="flex items-start gap-4">
        {/* Circular avatar preview */}
        <div className="relative flex-shrink-0">
          <div
            className={`
              w-24 h-24 rounded-full overflow-hidden border-2 
              ${error ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'}
              ${loading ? 'opacity-50' : ''}
            `}
            aria-label={displayUrl ? 'Avatar preview' : 'Avatar placeholder'}
          >
            {displayUrl ? (
              <img
                src={displayUrl}
                alt={userName ? `${userName}'s avatar` : 'Avatar'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-400 to-primary-600 text-white text-2xl font-semibold">
                {initials}
              </div>
            )}
          </div>

          {/* Loading spinner overlay */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-full">
              <svg
                className="animate-spin h-8 w-8 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Upload area */}
        <div className="flex-1 min-w-0">
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Profile Picture
          </label>

          <div
            role="button"
            tabIndex={disabled || loading ? -1 : 0}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            aria-label="Upload avatar"
            aria-disabled={disabled || loading}
            className={`
              relative rounded-lg border-2 border-dashed p-4 text-center transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900
              ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              ${error ? 'border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/10' : 
                isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 
                'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 bg-gray-50 dark:bg-gray-800/50'}
            `}
          >
            <svg
              className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              <span className="font-medium text-primary-600 dark:text-primary-400">
                {isDragging ? 'Drop image here' : 'Click to upload'}
              </span>
              {!isDragging && ' or drag and drop'}
            </p>
            <p id={descId} className="text-xs text-gray-500 dark:text-gray-500">
              JPG or PNG, max {formatFileSize(maxSize)}
            </p>
          </div>

          {/* Upload button (shown when file is selected) */}
          {selectedFile && onUpload && !loading && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={disabled}
              className="mt-3 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Upload Avatar
            </button>
          )}

          {/* Error message */}
          {error && (
            <div
              id={errorId}
              role="alert"
              aria-live="assertive"
              className="mt-2 text-sm text-red-600 dark:text-red-400 animate-shake"
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AvatarUpload;
