import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          cyan: "#22d3ee",
          "cyan-dim": "#38bdf8",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "soft-glow": "softGlow 2.5s ease-in-out 0.5s 2 forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        softGlow: {
          "0%, 100%": { boxShadow: "0 0 0 1px rgba(34, 211, 238, 0.15)" },
          "50%": { boxShadow: "0 0 0 1px rgba(34, 211, 238, 0.35), 0 0 24px -4px rgba(34, 211, 238, 0.12)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-mesh": "linear-gradient(135deg, rgba(34,211,238,0.03) 0%, transparent 50%, rgba(59,130,246,0.03) 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
