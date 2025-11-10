/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/sections/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Your existing scales (kept as-is)
        purple: {
          50:  "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
          400: "#c084fc",
          500: "#a855f7", // Main purple color from design
          600: "#9333ea",
          700: "#7e22ce",
          800: "#6b21a8",
          900: "#581c87",
        },
        gray: {
          900: "#111111",
          800: "#1a1a1a",
          700: "#2a2a2a",
          600: "#3a3a3a",
          500: "#6b7280",
          400: "#9ca3af",
          300: "#d1d5db",
          200: "#e5e7eb",
          100: "#f3f4f6",
          50:  "#f9fafb",
        },

        /* ────────────────────────────────────────────
           Brand UI tokens for the dark sidebar theme
        ──────────────────────────────────────────── */
        // Deep ink surfaces
        ink: {
          900: "#0E0F12", // page bg / vignette
          800: "#121316", // main panel
          700: "#17181C", // hover / inner panel
          line: "#26272B", // subtle divider
        },
        // Neutral text scale tuned for dark UI
        neu: {
          50:  "#F5F6F7",
          200: "#D3D6DC",
          400: "#A6ABB4",
          500: "#8A9099",
          600: "#757B86",
          700: "#5B616C",
        },
        // Accent (purple) for highlights
        accent: {
          300: "#C084FC", // ≈ Tailwind purple-400
          400: "#A78BFA", // slightly cooler mid
          500: "#8B5CF6", // vibrant
          600: "#7C3AED", // deep
        },
        // States
        danger: "#EF4444",
        success: "#22C55E",
        amber:  "#F59E0B",
      },

      // Soft elevated panel shadow used on sidebar/card
      boxShadow: {
        panel: "0 8px 28px rgba(0,0,0,.30)",
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
