/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#6366f1",
        "primary-hover": "#818cf8",
        surface: "#18181b",
        "surface-hover": "#27272a",
        "surface-active": "#3f3f46",
        border: "#3f3f46",
      },
    },
  },
  plugins: [],
};
