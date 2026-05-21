/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        glowza: {
          pink: '#B0125B',
          hot: '#FF4FA3',
          blush: '#FFD6E7',
          lavender: '#E9D5FF',
          plum: '#2C1022',
          wine: '#82123E',
          gold: '#D4AF37',
          mist: '#FFF7FA'
        }
      },
      boxShadow: {
        glow: '0 24px 70px rgba(176, 18, 91, 0.13)'
      },
      fontFamily: {
        sans: ['Gopher', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
};
