import type { Config } from "tailwindcss";

export default {
  content: ["./extension/**/*.{html,js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        lumen: {
          50: "#f0f4ff",
          100: "#dce6ff",
          200: "#b9cdff",
          300: "#86a9ff",
          400: "#567bff",
          500: "#3a5bff",
          600: "#2038f5",
          700: "#1929e1",
          800: "#1b24b6",
          900: "#1c2590",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
