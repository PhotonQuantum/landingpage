# LightQuantum's Profile Page

Website: [lightquantum.me](https://lightquantum.me)

> This site is now built with [SolidJS](https://solidjs.com/). Check [PhotonQuantum/landingpage-nextjs](https://github.com/PhotonQuantum/landingpage-nextjs) for the old next.js version.

## As a template

You are free to use this repo as a template for your own website. Please read [License](#license) for more information.

## Customize

### Content

**tl;dr** Replace all content in `public` (except favicons) and `src/assets` with your own. Modify
`src/routes/(profile).tsx` to change the layout. Modify `app/routes/(profile)/*.mdx` to change the content.

1. **Name** - Edit `src/routs/(profile).tsx`.
2. **Avatar** - Replace `src/assets/images/avatar.jpg` with your own avatar. Also replace `public/favicon.ico`. You can
   use [this website](https://favicon.io/favicon-converter/) to generate favicons.
3. **Profile** - Edit `src/routes/(profile)/*.mdx` to change the content of your profile pages. Beware that you need to
   add a small piece of `export const metadata` for each page to get listed in the nav bar. Refer to existing pages for
   examples.
4. **Footer** - Edit `src/routs/(profile).tsx` to change the content of the footer.

Check [FAQ](#faq) for more information.

### Theme

This site uses [catppuccin](https://github.com/catppuccin/catppuccin) as the theme.
It has multiple variants. You can switch to a different variant by modifying `app/layout.tsx`.

To change specific colors, please modify `tailwind.config.js` and `src/app.css`.

### Images

> TODO

### Fonts

> TODO

### Icons

## Deploy

This template is ready to be deployed to Cloudflare Pages.

If using `wrangler`,

1. `pnpm run dev`
2. `pnpx wrangler pages deploy`

If using the Cloudflare Pages UI, just connect the repo and deploy. Build command is `pnpm run build` and output
directory is `dist`.

You can also deploy it to other JAM stack providers. Don't forget to modify the `server` section of `app.config.ts` if
you decide to do so. Refer
to [solidstart document](https://docs.solidjs.com/solid-start/reference/config/define-config#configuring-nitro) for more
information.

## Development

`pnpm run dev` for hot-reloading development.

`pnpm run build` and `pnpx wrangler pages dev` for testing the production build.

## FAQ

1. How to make text italic only (not bold)?\
   By default italic text is made bold. To make it italic only, use `:it[blabla]`.
2. How to add custom Tailwind styles to paragraphs in MDX?\
   Use `::p[blabla]{.your-class}`.
3. I'd like to add a line break in a paragraph, but not start a new paragraph.\
   Add `\` at the end of the line.
4. How to add a new page?
   Just add a new `mdx` or `jsx` file in `src/routes/(profile)`. Don't forget to export `metadata` for the page to be
   listed in the nav bar.
5. I noticed you added some new syntax to MDX. How can I use them / add my own?\
   Check `components` in `src/app.tsx`. Also, refer
   to [remark-directive-rehype](https://github.com/IGassmann/remark-directive-rehype).
6. Page gets reloaded when I click on a link.\
   You need to use `A` from `@solidjs/router` instead of `a` tag for internal links. Refer to
   `src/routes/(profile)/links.mdx` for an example.

## License

All rights reserved for images, documents, slides, PDFs, MDXs, and all files under `public` and `src/assets`.
The rest of the code is licensed under MIT.

You can use this repo as a template for your own website, but you must replace all the content with your
own. Please also bring your own favicon and avatar.
