'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Input,
  Select,
  Textarea,
  CurrencySelector,
  FileUpload,
  Badge,
  StatusIndicator,
} from '@/components/ui';

export default function UIShowcasePage() {
  const [inputVal, setInputVal] = useState('');
  const [selectVal, setSelectVal] = useState('');
  const [textareaVal, setTextareaVal] = useState('');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <header className="max-w-2xl mx-auto mb-8">
        <Link href="/" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
          ← Back to MyFans
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">UI components</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Form inputs, badges, status indicators (a11y-friendly).</p>
      </header>

      <main className="max-w-2xl mx-auto space-y-10">
        <section aria-labelledby="form-heading">
          <h2 id="form-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Form inputs
          </h2>
          <div className="space-y-4">
            <Input
              label="Name"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Your name"
              hint="We use this for display."
            />
            <Input
              label="Email with error"
              placeholder="email@example.com"
              error="Please enter a valid email."
            />
            <Select
              label="Country"
              options={[
                { value: 'us', label: 'United States' },
                { value: 'uk', label: 'United Kingdom' },
              ]}
              placeholder="Select..."
              value={selectVal}
              onChange={(e) => setSelectVal(e.target.value)}
            />
            <Textarea
              label="Bio"
              value={textareaVal}
              onChange={(e) => setTextareaVal(e.target.value)}
              placeholder="Tell us about yourself."
              rows={3}
            />
            <CurrencySelector
              label="Currency"
              value="USD"
              onChange={() => {}}
            />
            <FileUpload
              label="Upload file"
              hint="PNG, JPG up to 10MB"
              onFiles={(files) => console.log(files)}
            />
          </div>
        </section>

        <section aria-labelledby="badges-heading">
          <h2 id="badges-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Badges
          </h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">Default</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </section>

        <section aria-labelledby="status-heading">
          <h2 id="status-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Status indicators
          </h2>
          <div className="flex flex-wrap gap-4">
            <StatusIndicator status="success" label="Active" />
            <StatusIndicator status="warning" label="Pending" />
            <StatusIndicator status="error" label="Failed" />
            <StatusIndicator status="info" label="Processing" />
            <StatusIndicator status="neutral" label="Draft" />
            <StatusIndicator status="pending" label="Loading" />
          </div>
        </section>
      </main>
    </div>
  );
}
