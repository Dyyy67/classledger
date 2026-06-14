/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        navy: {
          DEFAULT: '#1E3A5F',
          light: '#264d7e',
          dark: '#152b47',
        },
      },
    },
  },
  plugins: [],
};
