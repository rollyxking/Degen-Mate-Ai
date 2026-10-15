/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { ink: '#0a0a14', card: '#12121f', line: '#24243a', neon: '#a855f7', volt: '#38bdf8' },
      boxShadow: { glow: '0 0 40px -8px rgba(168,85,247,.55)' },
      keyframes: { float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } } },
      animation: { float: 'float 5s ease-in-out infinite' },
    },
  },
  plugins: [],
};
