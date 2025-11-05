/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#2f7a6a',
          primaryDark: '#246556',
          accent: '#8dd3b2',
          surface: '#f5f8f7',
          background: '#f9fbfa',
          muted: '#6b7280',
          border: '#d1d5db',
          ink: '#0f172a'
        }
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Inter"', 'system-ui', 'sans-serif']
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      boxShadow: {
        soft: '0 12px 40px -24px rgba(15, 23, 42, 0.35)'
      },
      borderRadius: {
        xl: '1.25rem'
      }
    },
  },
  plugins: [require("daisyui")],
};
