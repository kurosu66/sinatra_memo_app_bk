import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg:      "#080c14",
        bg2:     "#0d1220",
        accent:  "#00e676",
        home:    "#2979ff",
        away:    "#ff5252",
        muted:   "#8892a4",
        card:    "rgba(255,255,255,0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
