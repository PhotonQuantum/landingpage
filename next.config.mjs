import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkGfm from "remark-gfm";
import createMDX from "@next/mdx";

const buildDate = new Date();
const buildDateString = `${buildDate.getUTCFullYear()}/${buildDate.getUTCMonth() + 1}/${buildDate.getUTCDate()}`;
const buildYearString = `${buildDate.getUTCFullYear()}`;

/** @type {import("next").NextConfig} */
const nextConfig = {
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  env: {
    lastUpdate: buildDateString,
    lastUpdateYear: buildYearString
  },
  typescript: {
    ignoreBuildErrors: true
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.pdf/,
      type: "asset/resource",
      generator: {
        filename: "public/[hash][ext]"
      }
    });

    return config;
  },
  async headers() {
    return [
      {
        source: "/.well-known/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*"
          }
        ]
      },
      {
        source: "/.well-known/openpgpkey/hu/(.*)",
        headers: [
          {
            key: "Content-Type",
            value: "application/octet-stream"
          }
        ]
      }
    ];
  }
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm, remarkDirective, remarkDirectiveRehype],
    rehypePlugins: []
  }
});

import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

// we only need to use the utility during development so we can check NODE_ENV
// (note: this check is recommended but completely optional)
if (process.env.NODE_ENV === "development" && !process.env.SKIP_CF_BINDINGS) {
  // we call the utility with the bindings we want to have access to
  await setupDevPlatform();
}

export default withMDX(nextConfig);