// THEME: change normal and accent colors of MDX content
const normal = "--catppuccin-color-text";
const accent = "--catppuccin-color-mauve";

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      typography: () => ({
        DEFAULT: {
          css: {
            strong: {
              fontWeight: "400"
            },
            h3: {
              fontWeight: "500"
            },
            a: {
              fontWeight: "inherit",
              textDecoration: "none",
              "&:hover": {
                textDecoration: "underline"
              }
            },
            'blockquote p:first-of-type::before': null,
            'blockquote p:last-of-type::after': null,
            // TODO: Using the theme() function migration
            "--tw-prose-body": `var(${normal})`,
            "--tw-prose-headings": `var(--color-black)`,
            "--tw-prose-lead": `var(${normal})`,
            "--tw-prose-links": `var(${accent})`,
            "--tw-prose-bold": `var(--color-black)`,
            "--tw-prose-counters": `var(${normal})`,
            "--tw-prose-bullets": `var(${normal})`,
            "--tw-prose-hr": `var(${normal})`,
            "--tw-prose-quotes": `var(${normal})`,
            "--tw-prose-quote-borders": `var(${normal})`,
            "--tw-prose-captions": `var(${normal})`,
            "--tw-prose-code": `var(${normal})`,
            "--tw-prose-pre-code": `var(${normal})`,
            "--tw-prose-pre-bg": `var(--color-gray-800)`,
            "--tw-prose-th-borders": `var(${normal})`,
            "--tw-prose-td-borders": `var(${normal})`,
            "--tw-prose-invert-body": `var(${normal})`,
            "--tw-prose-invert-headings": `var(--color-white)`,
            "--tw-prose-invert-lead": `var(${normal})`,
            "--tw-prose-invert-links": `var(${accent})`,
            "--tw-prose-invert-bold": `var(--color-white)`,
            "--tw-prose-invert-counters": `var(${normal})`,
            "--tw-prose-invert-bullets": `var(${normal})`,
            "--tw-prose-invert-hr": `var(${normal})`,
            "--tw-prose-invert-quotes": `var(${normal})`,
            "--tw-prose-invert-quote-borders": `var(${normal})`,
            "--tw-prose-invert-captions": `var(${normal})`,
            "--tw-prose-invert-code": `var(--color-white)`,
            "--tw-prose-invert-pre-code": `var(${normal})`,
            "--tw-prose-invert-pre-bg": "rgb(0 0 0 / 50%)",
            "--tw-prose-invert-th-borders": `var(${normal})`,
            "--tw-prose-invert-td-borders": `var(${normal})`
          }
        }
      })
    }
  },
};
