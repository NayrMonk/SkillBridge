/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: false,
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* shadcn CSS-var mapped colors (keep for component compat) */
        border:      "rgb(var(--border) / <alpha-value>)",
        input:       "rgb(var(--input) / <alpha-value>)",
        ring:        "rgb(var(--ring) / <alpha-value>)",
        background:  "rgb(var(--background) / <alpha-value>)",
        foreground:  "rgb(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT:    "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT:    "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT:    "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT:    "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT:    "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT:    "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT:    "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT:             "rgb(var(--sidebar-background) / <alpha-value>)",
          foreground:          "rgba(232,245,238,0.75)",
          primary:             "rgb(var(--sidebar-primary) / <alpha-value>)",
          "primary-foreground":"rgb(var(--sidebar-primary-foreground) / <alpha-value>)",
          accent:              "rgba(232,245,238,0.07)",
          "accent-foreground": "rgba(232,245,238,0.95)",
          border:              "rgba(232,245,238,0.07)",
          ring:                "rgb(var(--sidebar-ring) / <alpha-value>)",
        },

        /* SkillBridge brand colors */
        brand: {
          DEFAULT:  '#1A6B47',
          dark:     '#124D33',
          light:    '#22885C',
          ghost:    'rgba(26,107,71,0.09)',
          'ghost-h':'rgba(26,107,71,0.16)',
        },
        canvas:   '#F4F6F4',
        surface:  '#FFFFFF',
        ink: {
          DEFAULT: '#111714',
          2:  '#2D3830',
          3:  '#536059',
          4:  '#8FA89A',
          5:  '#C8D5CF',
          6:  '#E8F0EB',
        },
        accent2: {
          DEFAULT: '#B8E0CE',
          soft:    '#EAF5EF',
        },
        /* Status */
        success:    { DEFAULT: '#166534', bg: '#DCFCE7' },
        warn:       { DEFAULT: '#92400E', bg: '#FEF3C7' },
        danger:     { DEFAULT: '#991B1B', bg: '#FEE2E2' },
        info:       { DEFAULT: '#1E40AF', bg: '#DBEAFE' },
        /* Promotion badges */
        hot:      '#FF4500',
        featured: '#F59E0B',
      },

      fontFamily: {
        display: ['Instrument Serif', 'Georgia', 'serif'],
        ui:      ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans:    ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },

      borderRadius: {
        '2xl': '1.5rem',
        xl:    '1rem',
        lg:    'var(--radius)',
        md:    '0.5rem',
        sm:    '0.375rem',
        xs:    '0.25rem',
      },

      boxShadow: {
        xs:  '0 1px 2px rgba(0,0,0,0.05)',
        sm:  '0 2px 8px rgba(0,0,0,0.07)',
        md:  '0 4px 20px rgba(0,0,0,0.09)',
        lg:  '0 8px 36px rgba(0,0,0,0.11)',
        xl:  '0 20px 60px rgba(0,0,0,0.13)',
      },

      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up":   { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "slide-up":       { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "fade-in":        { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "slide-up":       "slide-up 0.25s ease-out",
        "fade-in":        "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
