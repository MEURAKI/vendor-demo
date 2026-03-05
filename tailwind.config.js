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
        // Standard Tailwind grays (matching style guide)
        gray: {
          950: "#030712",
          900: "#111827",
          800: "#1f2937",
          700: "#374151",
          600: "#4b5563",
          500: "#6b7280",
          400: "#9ca3af",
          300: "#d1d5db",
          200: "#e5e7eb",
          100: "#f3f4f6",
          50:  "#f9fafb",
        },

        // Brand purple
        purple: {
          50:  "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
          400: "#c084fc",
          500: "#a855f7",
          600: "#9333ea",
          700: "#7e22ce",
          800: "#6b21a8",
          900: "#581c87",
        },

        // Primary / secondary aliases
        primary: {
          50:  "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
          400: "#c084fc",
          500: "#a855f7",
          600: "#9333ea",
          700: "#7e22ce",
          800: "#6b21a8",
          900: "#581c87",
        },
        secondary: {
          50:  "#fdf4ff",
          100: "#fae8ff",
          200: "#f5d0fe",
          300: "#f0abfc",
          400: "#e879f9",
          500: "#d946ef",
          600: "#c026d3",
          700: "#a21caf",
          800: "#86198f",
          900: "#701a75",
        },

        /* ────────────────────────────────────────────
           Dark sidebar tokens (remapped to style guide)
        ──────────────────────────────────────────── */
        ink: {
          900: "#030712", // gray-950
          800: "#030712", // gray-950 — sidebar background
          700: "#111827", // gray-900 — hover / inner panel
          600: "#1f2937", // gray-800 — flyout active
          line: "#1f2937", // gray-800 — subtle dividers
        },

        // Neutral text scale (tuned for dark sidebar)
        neu: {
          50:  "#f9fafb", // gray-50  — brightest text
          200: "#9ca3af", // gray-400 — default sidebar text
          300: "#9ca3af", // gray-400 — icons
          400: "#9ca3af", // gray-400
          500: "#6b7280", // gray-500 — secondary text
          600: "#4b5563", // gray-600 — section labels
          700: "#374151", // gray-700
        },

        // Accent purple for sidebar highlights
        accent: {
          300: "#c084fc", // purple-400
          400: "#c084fc", // purple-400
          500: "#a855f7", // purple-500
          600: "#9333ea", // purple-600
        },

        // States
        danger:  "#EF4444",
        success: "#22C55E",
        amber:   "#F59E0B",
      },

      boxShadow: {
        panel: "0 8px 28px rgba(0,0,0,.30)",
      },

      keyframes: {
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "gradient-shift": "gradient-shift 12s ease infinite",
      },

      fontFamily: {
        sans: ["var(--font-poppins)", "Poppins", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
