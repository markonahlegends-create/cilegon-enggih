/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f5fa',
          100: '#dde7f3',
          200: '#c2d5ea',
          300: '#98b9dc',
          400: '#6895ca',
          500: '#4576b7',
          600: '#335c9a',
          700: '#2a4a7d',
          800: '#1B365D', // Primary Biru Baja / Navy
          900: '#152947',
          950: '#0d192d',
        },
        forest: {
          50: '#f1f8f3',
          100: '#deefe2',
          200: '#bfdfc8',
          300: '#92c7a3',
          400: '#5fa978',
          500: '#3d8b57',
          600: '#2E6F40', // Primary Hijau Tosca / Forest Green
          700: '#255935',
          800: '#20472c',
          900: '#1b3b25',
          950: '#0e2114',
        },
        amberbrand: {
          50: '#fdf9ed',
          100: '#f9efce',
          200: '#f3dd9b',
          300: '#ecc562',
          400: '#E5A93C', // Primary Kuning Emas / Amber CTA
          500: '#d89124',
          600: '#bc701b',
          700: '#9c5219',
          800: '#80411b',
          900: '#6a3619',
        },
        surface: {
          DEFAULT: '#F8FAF8',
          warm: '#F4F7F5',
          card: '#FFFFFF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(27, 54, 93, 0.06), 0 2px 6px -1px rgba(46, 111, 64, 0.04)',
        'card': '0 2px 12px rgba(27, 54, 93, 0.07)',
        'card-hover': '0 12px 28px -4px rgba(27, 54, 93, 0.14), 0 4px 10px -2px rgba(46, 111, 64, 0.08)',
      },
    },
  },
  plugins: [],
}
