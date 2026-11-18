/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#E05206', dark: '#B84204', light: '#FFF1E8' },
        sahel: { DEFAULT: '#0D8A3E', light: '#E7F6EC' },
        ink: '#0b1410',
      },
      fontFamily: { sans: ['Inter Variable', 'system-ui', 'sans-serif'], display: ['Anton', 'sans-serif'] },
    },
  },
  plugins: [],
}
