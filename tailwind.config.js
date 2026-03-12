/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ── Primary (Blue) ──────────────────────────── */
        primary: {
          50:  '#F0F7FF',
          100: '#DDEAFA',
          200: '#B8D6F8',
          300: '#84C1FC',   /* blue-400 — focus ring */
          400: '#5BA3F5',
          500: '#3782E7',   /* hover */
          600: '#196CDF',   /* ← brand anchor */
          700: '#0C4A9C',   /* active / pressed */
          800: '#0A3D82',
          900: '#012957',   /* navy-1000 — text / dark */
          950: '#011E40',
        },
        /* ── Navy (secondary / text) ─────────────────── */
        navy: {
          50:  '#F0F4F9',
          100: '#DDEAF7',
          200: '#B8D0E8',
          300: '#8AADCC',
          400: '#6B8FAE',
          500: '#465D77',   /* slate-800 — muted text */
          600: '#3A4E67',
          700: '#2E3F55',
          800: '#1E293A',   /* neutral dark */
          900: '#012957',   /* navy-1000 */
          950: '#011A3A',
        },
        /* ── Success (Green) ─────────────────────────── */
        success: {
          50:  '#EEFBF6',
          100: '#D1F5E8',
          200: '#A6EAD3',
          300: '#6DD8B5',
          400: '#34C497',
          500: '#19A27E',   /* ← anchor */
          600: '#108265',
          700: '#0D6B53',
          800: '#0B5544',
          900: '#094537',
        },
        /* ── Warning (Gold) ──────────────────────────── */
        warning: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#F4C652',   /* ← anchor */
          400: '#EDBA3A',
          500: '#D3A95C',   /* hover */
          600: '#B8922D',
          700: '#9A7A24',
          800: '#7C621D',
          900: '#655118',
        },
        /* ── Info (Aqua) ─────────────────────────────── */
        info: {
          50:  '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#29C9E0',   /* ← anchor */
          500: '#26A2BA',
          600: '#1F8FA6',
          700: '#197589',
          800: '#155E6E',
          900: '#114D5A',
        },
        /* ── Surface / Neutral tokens ────────────────── */
        surface: {
          DEFAULT: '#FFFFFF',
          muted:   '#E8EDF3',
        },
        bg: {
          DEFAULT: '#F4F8FC',
        },
        border: {
          DEFAULT: '#C3C9D6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
