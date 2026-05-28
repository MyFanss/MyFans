import type { Preview } from '@storybook/react';

// Import Tailwind CSS and global styles
import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Adding standard next.js backgrounds and dark mode controls if needed later
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#0f172a' }, // slate-900
      ],
    },
  },
};

export default preview;
