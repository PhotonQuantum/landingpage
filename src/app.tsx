import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { For, onMount, Suspense } from "solid-js";
// @ts-ignore
import { MDXProvider } from "solid-mdx";
import "./app.css";
import { fontStyle, preloadFonts } from "./fonts";
import { Link, Meta, MetaProvider, Title } from "@solidjs/meta";
import { flavors } from "@catppuccin/palette";


const components = {
  em: (props: any) => <em class="text-strong" {...props} />,
  it: (props: any) => <em {...props} />,
  // a: (props: any) => <A {...props} />,
}

export default function App() {
  const lightColor = flavors.latte.colors.base.hex;
  const darkColor = flavors.mocha.colors.base.hex;
  onMount(() => {
    for (const [key, value] of Object.entries(fontStyle)) {
      document.documentElement.style.setProperty(key, value);
    }
  });
  return (
    <MetaProvider>
      <Title>Yanning Chen</Title>
      <For each={preloadFonts}>{(path) => (
        // TODO custom type
        <Link rel="preload" href={path} as="font" crossOrigin="anonymous" type="font/woff2" />
      )}</For>
      <Link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <Link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <Link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <Link rel="manifest" href="/site.webmanifest" />
      <Meta name="theme-color" content={lightColor} media="(prefers-color-scheme: light)" />
      <Meta name="theme-color" content={darkColor} media="(prefers-color-scheme: dark)" />
      <MDXProvider components={components}>
        <Router
          explicitLinks
          root={props => (
            <main class="font-normal font-sans">
              <div class="min-h-screen w-full flex justify-center">
                <Suspense>{props.children}</Suspense>
              </div>
            </main>
          )
          }
        >
          <FileRoutes />
        </Router>
      </MDXProvider>
    </MetaProvider>
  )
    ;
}


