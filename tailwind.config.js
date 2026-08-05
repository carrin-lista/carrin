/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'carrin-primary': '#23CE6B',
        'carrin-dark': '#272D2D',
        'carrin-bg': '#F6F8FF',
      },
      borderRadius: {
        'small': '12px',
        'button': '16px',
        'card': '20px',
        'large': '28px',
      }
    },
  },
  plugins: [],
}