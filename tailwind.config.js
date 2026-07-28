/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      "colors": {
        "surface-container-lowest": "var(--color-surface-lowest)",
        "primary-container": "var(--color-primary-container)",
        "primary": "var(--color-primary)",
        "surface-container": "var(--color-surface-container)",
        "surface-container-high": "var(--color-surface-high)",
        "outline-variant": "var(--color-outline-variant)",
        "on-surface": "var(--color-on-surface)",
        "surface-container-low": "var(--color-surface-low)",
        "surface": "var(--color-surface)",
        "surface-container-highest": "var(--color-surface-highest)",
        "outline": "var(--color-outline)",
        "on-primary": "var(--color-on-primary)",
        "background": "var(--color-surface-lowest)",
        "on-background": "var(--color-on-surface)",
        "error": "#ffb4ab",
        "error-container": "#93000a",
        "on-error": "#690005",
        "on-error-container": "#ffdad6"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      "spacing": {
        "md": "16px",
        "sm": "12px",
        "xs": "8px",
        "base": "4px",
        "xl": "32px",
        "lg": "24px",
        "sidebar-width": "var(--sidebar-width)",
        "gutter": "16px"
      },
      "fontFamily": {
        "headline-md": ["Inter"],
        "body-md": ["Inter"],
        "body-lg": ["Inter"],
        "headline-lg-mobile": ["Inter"],
        "label-sm": ["Inter"],
        "headline-lg": ["Inter"],
        "label-md": ["Inter"]
      },
      "fontSize": {
        "headline-md": ["24px", { "lineHeight": "1.3", "fontWeight": "500" }],
        "body-md": ["14px", { "lineHeight": "1.5", "fontWeight": "400" }],
        "body-lg": ["16px", { "lineHeight": "1.6", "fontWeight": "400" }],
        "headline-lg-mobile": ["24px", { "lineHeight": "1.2", "fontWeight": "600" }],
        "label-sm": ["12px", { "lineHeight": "1.1", "fontWeight": "500" }],
        "headline-lg": ["32px", { "lineHeight": "1.2", "letterSpacing": "-0.02em", "fontWeight": "600" }],
        "label-md": ["14px", { "lineHeight": "1.2", "fontWeight": "500" }]
      }
    },
  },
  plugins: [],
}
