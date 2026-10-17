import type { Config } from "tailwindcss";

// Tailwind CSS v4 uses CSS-based configuration via @theme in globals.css.
// Only keep non-theme configuration here.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  plugins: [],
};

export default config;
