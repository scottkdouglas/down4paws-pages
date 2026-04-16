/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        purple: {
          DEFAULT: '#632a9f',
          light: '#8b5fbf',
          soft: '#e8dff5',
          mist: '#f3eef9',
          deep: '#4a1d78',
        },
        orange: {
          DEFAULT: '#f36e14',
          light: '#ffa574',
          soft: '#ffd4b8',
          bright: '#ff7a22',
        },
        cream: '#fef9f3',
        'warm-white': '#fffcf7',
        beige: '#f5ede3',
        terracotta: '#d97757',
        sage: '#a8b5a1',
        'warm-gray': '#6b6560',
        charcoal: '#2a2522',
      },
      fontFamily: {
        display: ['"Bubblegum Sans"', 'cursive'],
        body: ['Raleway', 'sans-serif'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-32px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(32px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s ease both',
        'fade-in': 'fade-in 0.6s ease both',
        'slide-in-left': 'slide-in-left 0.7s ease both',
        'slide-in-right': 'slide-in-right 0.7s ease both',
        'scale-in': 'scale-in 0.6s ease both',
        float: 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
