import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './client/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
