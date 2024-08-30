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

import { setupDevBindings } from "@cloudflare/next-on-pages/__experimental__next-dev";

// we only need to use the utility during development so we can check NODE_ENV
// (note: this check is recommended but completely optional)
if (process.env.NODE_ENV === "development" && !process.env.SKIP_CF_BINDINGS) {
  // we call the utility with the bindings we want to have access to
  setupDevBindings({
    d1Databases: {
      "DB_TWEET": "7116ce7a-eff4-4de8-95cc-7263c2356a6a"
    }
  });
}

export default withMDX(nextConfig);