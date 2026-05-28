'use client';

import { useState } from 'react';

export default function ErrorTestPage() {
  const [shouldError, setShouldError] = useState(false);

  if (shouldError) {
    throw new Error('Test error: Error boundary triggered');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Error Boundary Test
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Click the button below to trigger an error and test the error boundary.
        </p>
        <button
          onClick={() => setShouldError(true)}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
        >
          Trigger Error
        </button>
      </div>
    </div>
  );
}
