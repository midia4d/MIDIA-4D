/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F8FAFC", /* Fundo BEM claro (quase branco) */
        foreground: "#0F172A", /* Texto MTO escuro para contraste absoluto */
        primary: {
          DEFAULT: "#2563EB",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#E2E8F0",
          foreground: "#0F172A",
        },
        accent: {
          DEFAULT: "#F1F5F9",
          foreground: "#0F172A",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#F1F5F9",
          foreground: "#64748B",
        },
        card: {
          DEFAULT: "#FFFFFF", /* Cards 100% brancos */
          foreground: "#0F172A",
        },
        border: "#E2E8F0", /* Borda cinza clara */
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
