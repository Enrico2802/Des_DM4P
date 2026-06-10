/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // High-contrast brand palette (WCAG-AA against white/near-black).
        brand: '#0b7285',
        accent: '#9c4221',
      },
    },
  },
  plugins: [],
};
