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

export default withMDX(nextConfig);