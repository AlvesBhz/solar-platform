/** Tokens espelhados de ../design-system/colors_and_type.css (mesmos nomes, via CSS vars). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pine: { DEFAULT: 'var(--c-pine)', deep: 'var(--c-pine-deep)', mid: 'var(--c-pine-mid)' },
        cream: 'var(--c-cream)',
        fg: { 1: 'var(--fg-1)', 2: 'var(--fg-2)', 3: 'var(--fg-3)', 4: 'var(--fg-4)', inverse: 'var(--fg-inverse)' },
        line: { 1: 'var(--border-1)', 2: 'var(--border-2)' },
        available: 'var(--c-available)',
        warning: { DEFAULT: 'var(--c-warning)', bg: 'var(--c-warning-bg)' },
        error: 'var(--c-error)',
      },
      fontFamily: { serif: 'var(--font-serif)', sans: 'var(--font-sans)', mono: 'var(--font-mono)' },
      borderRadius: { md: 'var(--r-md)', lg: 'var(--r-lg)', xl: 'var(--r-xl)', '2xl': 'var(--r-2xl)' },
      boxShadow: { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)' },
      transitionDuration: { fast: '150ms', base: '300ms' },
    },
  },
  plugins: [],
};
