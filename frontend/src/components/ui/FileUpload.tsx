'use client';

import React, { useState, useRef } from 'react';

export interface FileUploadProps {
  label: string;
  accept?: string;
  multiple?: boolean;
  onFiles?: (files: File[]) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({
  label,
  accept,
  multiple = false,
  onFiles,
  hint,
  error,
  disabled = false,
  className = '',
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputId = React.useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles?.(multiple ? files : files.slice(0, 1));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onFiles?.(multiple ? files : files.slice(0, 1));
    e.target.value = '';
  };

  return (
    <div className={className}>
      <span id={`${inputId}-label`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </span>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        aria-invalid={!!error}
        aria-disabled={disabled}
        className={`
          flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${error ? 'border-red-500 dark:border-red-500' : isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'}
        `}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          disabled={disabled}
          aria-labelledby={`${inputId}-label`}
          className="sr-only"
        />
        <svg className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Drag and drop or <span className="text-primary-600 dark:text-primary-400 font-medium">browse</span>
        </span>
      </div>
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
}

export default FileUpload;
