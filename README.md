# LightQuantum's Profile Page

Website: [lightquantum.me](https://lightquantum.me)

## As a template

You are free to use this repo as a template for your own website. Please read [License](#license) for more information.

## Customize

### Content

1. **Name** - Edit `app/(profile)/layout.tsx`.
2. **Avatar** - Replace `app/(profile)/avatar.jpg` with your own avatar. Also replace `public/favicon.ico`.
3. **Profile** - Edit `app/(profile)/*/page.mdx` to change the content of your profile pages. If you added or removed
   pages, please also modify `app/(profile)/layout.tsx` to reflect the changes in the nav bar.
4. **Schedule** - Edit `app/schedule/page.tsx` to include ics urls of your schedule.
6. **Footer** - Edit `app/(profile)/layout.tsx` to change the content of the footer. To credit me (and yourself)
   properly, you may wish to modify the footer.

Check [FAQ](#faq) for more information.

### Theme

This site uses [catppuccin](https://github.com/catppuccin/catppuccin) as the theme.
It has multiple variants. You can switch to a different variant by modifying `app/layout.tsx`.

To change specific colors, please modify `tailwind.config.js` and `app/globals.css`.

Look for `THEME:` comments in the codebase for more information.

## Deploy

1. Fork this repo. Modify the content in `app/(profile)` folder.
2. Delete `app/api` and `app/admin`. Remove all `<Timeline />` components.
3. [Deploy](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/#deploy-with-cloudflare-pages) your
   website to Cloudflare Pages.
   Please choose `next.js` as the framework, and change the build command to `pnpx @cloudflare/next-on-pages@1`.

## Development

Run `pnpm run dev`.
## Troubleshooting

1. `The following routes were not configured to run with the Edge Runtime: blabla`
    - You need to switch to edge runtime to deploy the website to cloudflare pages.
    - You can do this by adding `export const runtime = "edge"` to `blabla/page.tsx`.
    - If you are using MDX, please create a dummy `layout.tsx` file alongside `blabla/page.mdx`.
      Check [this](app/(profile)/misc/layout.tsx) for example.

## FAQ

1. How to make text italic without being bold in MDX?\
   Use `:it[blabla]`.
2. How to add custom Tailwind styles to paragraphs in MDX?\
   Use `::p[blabla]{.your-class}`.
3. I'd like to add a line break in a paragraph, but not start a new paragraph.\
   Add `\` at the end of the line.
4. `<Image />` component causes error when building.\
   This is a bug in next.js. I've added a workaround. All you need to do is to remove the import statement of `Image` in
   MDX files.
5. How to add a new page?
    - Create a new folder in `app/(profile)`. Add `page.mdx` to the folder.
    - Add it to the nav bar by modifying `app/(profile)/layout.tsx`.
6. I noticed you added some new syntax to MDX. How can I use them / add my own?\
   Check custom components in `mdx-components.tsx`. Also, refer
   to [remark-directive-rehype](https://github.com/IGassmann/remark-directive-rehype).

## License

All rights reserved for images, documents, slides, PDFs, MDXs, and all files under `public`.
The rest of the code is licensed under MIT.

You can use this repo as a template for your own website, but you must replace all the content with your
own. Please also bring your own favicon and avatar.