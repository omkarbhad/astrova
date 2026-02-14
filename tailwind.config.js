/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(32.1, 94.6%, 43.7%)',
          foreground: 'hsl(0, 0%, 98%)',
        },
        dark: {
          DEFAULT: '#171717',
        },
      },
    },
  },
  plugins: [],
}
