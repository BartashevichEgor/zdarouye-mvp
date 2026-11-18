import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#015DF8',
          start: '#5191FB',
          soft: '#EAF2FF',
          muted: '#B6D0FF',
        },
        mint: { DEFAULT: '#04B2B0', soft: '#DDF7F1' },
        canvas: '#F7F9FC',
        surface: '#FFFFFF',
        'surface-blue': '#EEF5FF',
        ink: '#161616',
        muted: '#737373',
        line: '#E2E5EA',
        status: {
          success: '#00AA80',
          'success-soft': '#DCF7ED',
          warning: '#E6A321',
          'warning-soft': '#FFF2D7',
          danger: '#FF6978',
          'danger-soft': '#FFE5E9',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'sans-serif'],
        logo: ['var(--font-pacifico)', 'Pacifico', 'cursive'],
      },
      borderRadius: {
        control: '12px',
        card: '16px',
        pill: '20px',
        nav: '28px',
      },
      boxShadow: {
        card: '0 2px 8px rgb(32 72 125 / 6%)',
        floating: '0 6px 18px rgb(32 72 125 / 10%)',
        cta: '0 4px 12px rgb(1 93 248 / 18%)',
      },
      backgroundImage: {
        brand: 'linear-gradient(101deg, #5191FB 12%, #015DF8 92%)',
        'brand-subtle': 'linear-gradient(103deg, rgb(152 188 250 / 30%) 16%, rgb(1 93 248 / 30%) 86%)',
        logo: 'linear-gradient(289deg, rgb(4 178 176 / 70%) 12%, rgb(1 93 248 / 70%) 100%)',
      },
      maxWidth: { mobile: '393px' },
      spacing: { page: '16px', card: '16px', touch: '44px' },
    },
  },
  plugins: [],
}

export default config
