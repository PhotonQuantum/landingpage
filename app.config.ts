import { defineConfig } from "@solidjs/start/config";
// @ts-ignore
import pkg from "@vinxi/plugin-mdx";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkGfm from "remark-gfm";

import solidSvg from "vite-plugin-solid-svg";
import Font from "vite-plugin-font";
import { FontaineTransform } from "fontaine"
import { imagetools, setMetadata } from "vite-imagetools";
import tailwindcss from "@tailwindcss/vite";
import { encode } from "blurhash";
import { blurhashToCssGradientString } from "@unpic/placeholder";
import exifReader from "exif-reader";

const { default: mdx } = pkg;

const buildDate = new Date();
const buildDateString = `${buildDate.getUTCFullYear()}/${buildDate.getUTCMonth() + 1}/${buildDate.getUTCDate()}`;
const buildYearString = `${buildDate.getUTCFullYear()}`;

// Function ported from https://github.com/Innei/photo-gallery
// License: MIT. Copyright (c) 2025 Innei.
// 清理 EXIF 数据中的空字符和无用信息
function cleanExifData(exifData: any): any {
  if (!exifData || typeof exifData !== 'object') {
    return exifData
  }

  if (Array.isArray(exifData)) {
    return exifData.map((item) => cleanExifData(item))
  }

  // 如果是 Date 对象，直接返回
  if (exifData instanceof Date) {
    return exifData
  }

  const cleaned: any = {}

  // 重要的日期字段，不应该被过度清理
  const importantDateFields = new Set([
    'DateTimeOriginal',
    'DateTime',
    'DateTimeDigitized',
    'CreateDate',
    'ModifyDate',
  ])

  for (const [key, value] of Object.entries(exifData)) {
    if (value === null || value === undefined) {
      continue
    }

    if (typeof value === 'string') {
      // 对于重要的日期字段，只移除空字符，不进行过度清理
      if (importantDateFields.has(key)) {
        const cleanedString = value.replaceAll('\0', '')
        if (cleanedString.length > 0) {
          cleaned[key] = cleanedString
        }
      } else {
        // 对于其他字符串字段，移除空字符并清理空白字符
        const cleanedString = value.replaceAll('\0', '').trim()
        if (cleanedString.length > 0) {
          cleaned[key] = cleanedString
        }
      }
    } else if (value instanceof Date) {
      // Date 对象直接保留
      cleaned[key] = value
    } else if (typeof value === 'object') {
      // 递归清理嵌套对象
      const cleanedNested = cleanExifData(value)
      if (cleanedNested && Object.keys(cleanedNested).length > 0) {
        cleaned[key] = cleanedNested
      }
    } else {
      // 其他类型直接保留
      cleaned[key] = value
    }
  }

  return cleaned
}

export default defineConfig({
  extensions: ["mdx", "md"],
  server: {
    compatibilityDate: "2024-12-10",
    preset: "cloudflare-pages",
    rollupConfig: {
      external: ["node:async_hooks"],
    },
  },
  vite: {
    define: {
      'import.meta.env.VITE_LAST_UPDATE': JSON.stringify(buildDateString),
      'import.meta.env.VITE_LAST_UPDATE_YEAR': JSON.stringify(buildYearString),
    },
    plugins: [
      mdx.withImports({})({
        jsx: true,
        jsxImportSource: "solid-js",
        providerImportSource: "solid-mdx",
        remarkPlugins: [remarkGfm, remarkDirective, remarkDirectiveRehype]
      }),
      solidSvg({
        svgo: { enabled: false }
      }),
      Font.vite({
        scanFiles: ["src/routes/**/*.{ts,tsx,js,jsx,md,mdx}"],
        include: [/.ttf(\?subsets)?$/, /.otf(\?subsets)?$/, /.woff2(\?subsets)?$/],
        exclude: [/fontsource/]
      }),
      FontaineTransform.vite({
        fallbacks: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"]
      }),
      imagetools({
        cache: {
          enabled: false,
        },
        defaultDirectives: new URLSearchParams({
          quality: "90",
          format: "webp;jpg",
          withoutEnlargement: "true",
          effort: "max",
          as: "picture"
        }),
        extendTransforms: (builtins) => [
          // EXIF extraction transform
          (metadata, ctx) => {
            if (!("exif" in metadata)) {
              return undefined;
            }

            return async function (image) {
              const exif = (await image.metadata()).exif;
              if (!exif) {
                return image;
              }
              const parsed = exifReader(exif);

              delete parsed.Photo?.MakerNote;
              delete parsed.Photo?.UserComment;
              delete parsed.Photo?.PrintImageMatching;
              delete parsed.Image?.PrintImageMatching;

              const cleaned = cleanExifData(parsed);

              setMetadata(image, "exif", cleaned);
              return image;
            }
          },
          ...builtins,
          (metadata, ctx) => {
            if (!("blurhash" in metadata)) {
              return undefined;
            }

            return async function (image) {
              const { data, info } = await image.ensureAlpha().raw().toBuffer({
                resolveWithObject: true,
              });

              // Calculate components based on aspect ratio
              const aspectRatio = info.width / info.height;
              const totalComponents = 12; // Keep total components reasonable
              const xComponents = Math.ceil(Math.sqrt(totalComponents * aspectRatio));
              const yComponents = Math.ceil(totalComponents / xComponents);

              const encoded = encode(
                new Uint8ClampedArray(data),
                info.width,
                info.height,
                xComponents,
                yComponents
              );

              setMetadata(image, "blurhash", encoded);
              setMetadata(image, "blurhashXComponents", xComponents);
              setMetadata(image, "blurhashYComponents", yComponents);

              // Generate CSS gradient string server-side using the same component counts
              const gradientString = blurhashToCssGradientString(encoded, xComponents, yComponents);
              setMetadata(image, "blurhashGradient", gradientString);

              return image
            }
          }
        ],
      }),
      tailwindcss(),
    ],
    logLevel: 'info'
  }
});