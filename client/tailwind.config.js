/** @type {import('tailwindcss').Config} */
// Tokens follow DESIGN.md (Framer-style dark canvas). Dark mode only.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#090909',
        surface: { 1: '#141414', 2: '#1c1c1c' },
        line: { DEFAULT: '#262626', soft: '#1a1a1a' },
        ink: '#ffffff',
        muted: '#999999',
        // Signal color: links, focus rings, selection. Never a button fill.
        accent: '#0099ff',
        // Semantic status only (present / absent, destructive).
        success: '#22c55e',
        danger: '#ff5577',
        spot: { magenta: '#d44df0', violet: '#6a4cf5', orange: '#ff7a3d', coral: '#ff5577' }
      },
      fontFamily: {
        display: ['"Geist Variable"', '"Inter Variable"', 'system-ui', 'sans-serif'],
        sans: ['"Inter Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      // Radius rule: inputs/list rows md 10, small tiles lg 15, cards/dialogs xl 20,
      // gradient spotlight xxl 30, every button pill, icon buttons full.
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '10px',
        lg: '15px',
        xl: '20px',
        xxl: '30px',
        pill: '100px'
      },
      backgroundImage: {
        'spot-violet': 'radial-gradient(130% 120% at 0% 0%, #8b6dff 0%, #6a4cf5 38%, #2b1b85 100%)',
        'spot-magenta': 'radial-gradient(130% 120% at 0% 0%, #f07bff 0%, #d44df0 35%, #5a1b8f 100%)',
        'spot-orange': 'radial-gradient(130% 120% at 0% 0%, #ffb37a 0%, #ff7a3d 38%, #b8243f 100%)'
      },
      boxShadow: {
        edge: 'inset 0 0.5px 0 rgba(255,255,255,0.10)',
        float: 'inset 0 0.5px 0 rgba(255,255,255,0.10), 0 10px 30px rgba(0,0,0,0.45)',
        ring: '0 0 0 1px rgba(0,153,255,0.35)'
      },
      // Layer scale: sticky chrome 30, nav drawer 40, popovers 50, modals 60, toasts 70.
      zIndex: { chrome: '30', drawer: '40', popover: '50', modal: '60', toast: '70' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'translateY(6px) scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } }
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'pop-in': 'pop-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'sheet-up': 'sheet-up 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        rise: 'rise 320ms cubic-bezier(0.16, 1, 0.3, 1) both'
      }
    }
  },
  plugins: []
};
