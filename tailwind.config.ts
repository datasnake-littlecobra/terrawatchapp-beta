import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0B1220',
          1: '#111A2E',
          2: '#1A2540',
        },
        ink: {
          primary: '#E6EDF7',
          muted: '#8A97B1',
          dim: '#5A6782',
        },
        accent: {
          DEFAULT: '#10B981',
          deep: '#059669',
          soft: '#34D399',
        },
        safe: '#3DDC97',
        caution: '#F5B74A',
        danger: '#FF6B6B',
        seismic: '#B46BFF',
        space: '#7EC9FF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        hero: ['5rem', { lineHeight: '1', letterSpacing: '-0.04em', fontWeight: '700' }],
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.5)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
} satisfies Config
