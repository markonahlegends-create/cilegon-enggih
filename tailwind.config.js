/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f2',
          100: '#ffe0e3',
          200: '#ffc6cc',
          300: '#ff9ea8',
          400: '#ff6676',
          500: '#f83a4f',
          600: '#e11d2e',
          700: '#bd1524',
          800: '#9c1623',
          900: '#821823',
          950: '#470810',
        },
        navy: {
          50: '#f2f6fc',
          100: '#e2ebf7',
          200: '#cadeef',
          300: '#a6c6e2',
          400: '#7ba8d3',
          500: '#5489c2',
          600: '#3f6da6',
          700: '#345787',
          800: '#2f4a70',
          900: '#0b2545',
          950: '#071a33',
        },
        gold: {
          400: '#f7bc3f',
          500: '#f0a500',
          600: '#cc8400',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, .06), 0 8px 24px -12px rgba(15, 23, 42, .18)',
        float: '0 10px 40px -12px rgba(15, 23, 42, .35)',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.45', transform: 'scale(.85)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        ticker: 'ticker 38s linear infinite',
        fadeUp: 'fadeUp .35s ease-out both',
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
