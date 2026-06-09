import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef5ff",
          100: "#d8e9ff",
          600: "#1f5fa8",
          700: "#174978",
          800: "#12385c",
          900: "#0b2545"
        },
        padu: {
          green: "#16a34a",
          gold: "#d7a21e"
        }
      }
    }
  },
  plugins: []
};

export default config;
