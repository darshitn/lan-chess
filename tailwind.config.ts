import type { Config } from 'tailwindcss';

// Keep Tailwind's responsive, hover, and opacity variants in sync with the
// selected app palette. The board squares and pieces have their own colors.
const token = (name: string) =>
  `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

const statusText = (name: string) =>
  Object.fromEntries([200, 300, 400, 500].map(level => [level, token(name)]));

export default {
  content: ['./index.html', './client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      textColor: {
        white: token('text-hi'),
        slate: { 100: token('text-hi'), 200: token('text-strong'), 300: token('text-body'), 400: token('text-muted-2'), 500: token('text-faint'), 600: token('text-dim') },
        amber: statusText('accent-text'), emerald: statusText('success-ink'),
        rose: statusText('error-ink'), sky: statusText('info-ink'), indigo: statusText('info-ink'),
        blue: statusText('info-ink'), teal: statusText('success-ink'), yellow: statusText('warning-ink'),
        orange: statusText('warning-ink'), violet: statusText('info-ink'),
      },
      backgroundColor: {
        slate: { 700: token('hover-raised'), 800: token('surface-raised'), 900: token('surface-main'), 950: token('surface-deep') },
        amber: { 400: token('accent-color'), 500: token('accent-color'), 950: token('warning-surface') },
        emerald: { 950: token('success-surface') }, rose: { 950: token('error-surface') },
        sky: { 950: token('info-surface') }, indigo: { 950: token('info-surface') }, violet: { 950: token('info-surface') },
      },
      borderColor: {
        slate: { 600: token('hover-border'), 700: token('border-soft'), 800: token('border-faint') },
        amber: { 400: token('accent-border'), 500: token('accent-border') },
      },
    },
  },
  plugins: [],
} satisfies Config;
