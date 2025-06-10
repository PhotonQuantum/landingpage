import { defineConfig } from "@solidjs/start/config";
// @ts-ignore
import pkg from "@vinxi/plugin-mdx";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";

import solidSvg from "vite-plugin-solid-svg";
import Font from "vite-plugin-font";
import { FontaineTransform } from "fontaine"
import { imagetools } from "vite-imagetools";
import tailwindcss from "@tailwindcss/vite";
import mdxClassesPlugin from "./scripts/vite-plugin-mdx-classes";

const { default: mdx } = pkg;

const buildDate = new Date();
const buildDateString = `${buildDate.getUTCFullYear()}/${buildDate.getUTCMonth() + 1}/${buildDate.getUTCDate()}`;
const buildYearString = `${buildDate.getUTCFullYear()}`;

export default defineConfig({
  extensions: ["mdx", "md"],
  server: {
    compatibilityDate: "2025-05-29",
  },
  vite: {
    server: {
      allowedHosts: [".trycloudflare.com"]
    },
    define: {
      'import.meta.env.VITE_LAST_UPDATE': JSON.stringify(buildDateString),
      'import.meta.env.VITE_LAST_UPDATE_YEAR': JSON.stringify(buildYearString),
    },
    plugins: [
      mdxClassesPlugin(),
      mdx.withImports({})({
        jsx: true,
        jsxImportSource: "solid-js",
        providerImportSource: "solid-mdx",
        remarkPlugins: [remarkGfm, remarkDirective, remarkDirectiveRehype],
        rehypePlugins: [rehypeSlug]
      }),
      solidSvg({
        svgo: { enabled: false }
      }),
      Font.vite({
        scanFiles: ["src/routes/**/*.{ts,tsx,js,jsx,md,mdx}"],
        include: [/.ttf(\?subsets)?$/, /.otf(\?subsets)?$/, /.woff2(\?subsets)?$/],
        exclude: [/fontsource/],
        cacheDir: ".cache/cn-font-split"
      }),
      FontaineTransform.vite({
        fallbacks: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"]
      }),
      imagetools({
        defaultDirectives: new URLSearchParams({
          quality: "90",
          format: "webp;jpg",
          withoutEnlargement: "true",
          effort: "max",
          as: "picture"
        }),
      }),
      tailwindcss(),
    ],
    logLevel: 'info'
  }
});