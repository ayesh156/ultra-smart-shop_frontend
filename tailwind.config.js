function cssVarColor(name) {
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  const scale = {};
  for (const s of shades) {
    scale[s] = `rgb(var(--${name}-${s}) / <alpha-value>)`;
  }
  return scale;
}

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        emerald: cssVarColor('accent'),
        teal: cssVarColor('accent2'),
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
