import { A, RouteSectionProps } from "@solidjs/router";
import { createSignal, createEffect } from "solid-js";
import { clickOutside } from "~/lib/gallery/utils";
import SvgMenu from "@tabler/icons/outline/menu.svg";
import SvgX from "@tabler/icons/outline/x.svg";
import SvgBrandGithub from "@tabler/icons/outline/brand-github.svg"
import { Portal } from "solid-js/web";

clickOutside; // NOTE avoid tree-shaking

// This layout is used for individual apps.
export default function AppLayout(props: RouteSectionProps) {
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [showOverlay, setShowOverlay] = createSignal(false);
  const [fadingOut, setFadingOut] = createSignal(false);
  let headerRef: HTMLHeadElement | undefined;

  // Overlay fade in/out logic
  createEffect(() => {
    if (menuOpen()) {
      setShowOverlay(true);
      setFadingOut(false);
    } else if (showOverlay()) {
      setFadingOut(true);
      setTimeout(() => {
        setShowOverlay(false);
        setFadingOut(false);
      }, 200); // match animation duration
    }
  });

  return (
    <div class="flex flex-col w-full">
      {/* Header with navigation */}
      <header ref={el => headerRef = el} class="border-b border-gray-200 dark:border-gray-800 bg-background-80 backdrop-blur-sm shadow-sm sticky top-0 z-90 w-full">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center h-16 justify-between">
            {/* Left side - Name and Navigation */}
            <div class="flex items-center">
              <span class="text-xl font-semibold text-label2">Yanning Chen</span>
              <span class="mx-4 text-label hidden sm:inline">/</span>
              {/* Desktop nav */}
              <nav class="hidden sm:flex items-center space-x-4">
                <A
                  href="/"
                  class="text-label border-b-2 border-transparent pt-1 hover:text-accent hover:border-accent motion-safe:transition-all motion-safe:duration-200"
                  activeClass="!text-accent !border-accent font-medium"
                  end={true}
                >
                  Home
                </A>
                <A
                  href="/gallery"
                  class="text-label border-b-2 border-transparent pt-1 hover:text-accent hover:border-accent motion-safe:transition-all motion-safe:duration-200"
                  activeClass="!text-accent !border-accent font-medium"
                  end={true}
                >
                  Gallery
                </A>
                {/* Add more navigation links as needed */}
              </nav>
            </div>
            {/* Hamburger for mobile */}
            <button
              class="sm:hidden p-2 rounded focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label={menuOpen() ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen(v => !v)}
            >
              <div class="relative w-6 h-6">
                <SvgMenu
                  class={`w-6 h-6 text-label2 absolute motion-safe:transition-all motion-safe:duration-200 ${menuOpen() ? 'opacity-0 rotate-90' : 'opacity-100 rotate-0'}`}
                />
                <SvgX
                  class={`w-6 h-6 text-label2 absolute motion-safe:transition-all motion-safe:duration-200 ${menuOpen() ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90'}`}
                />
              </div>
            </button>
          </div>
        </div>
        {/* Mobile dropdown nav backdrop */}
        {showOverlay() && (
          <Portal>
            <div
              aria-hidden="true"
              class={`fixed inset-0 bg-black/30 sm:hidden z-30 pointer-events-auto animate-fade-in ${fadingOut() && 'transition-opacity opacity-0 duration-200'}`}
            />
          </Portal>
        )}
        {/* Mobile dropdown nav */}
        <div
          use:clickOutside={(e) => {
            if (!menuOpen()) return;
            // Only collapse if click is outside both dropdown and header
            if (headerRef && !headerRef.contains(e.target as Node)) {
              setMenuOpen(false);
            }
          }}
          class={`sm:hidden absolute w-full bg-background-95 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 overflow-hidden motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-in-out shadow-lg z-50 ${menuOpen() ? 'max-h-60 overflow-y-scroll opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-2'}`}
        >
          <div class="container mx-auto px-4 sm:px-6 lg:px-8">
            <nav class="py-3">
              <A
                href="/"
                class="block py-2.5 text-label border-b-2 border-transparent hover:text-accent hover:border-accent motion-safe:transition-all motion-safe:duration-200"
                activeClass="!text-accent !border-accent font-medium"
                end={true}
                onClick={() => setMenuOpen(false)}
              >
                Home
              </A>
              <A
                href="/gallery"
                class="block py-2.5 text-label border-b-2 border-transparent hover:text-accent hover:border-accent motion-safe:transition-all motion-safe:duration-200"
                activeClass="!text-accent !border-accent font-medium"
                end={true}
                onClick={() => setMenuOpen(false)}
              >
                Gallery
              </A>
              {/* Add more navigation links as needed */}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main class="flex-1">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-2">
          {props.children}
        </div>
      </main>

      {/* Footer */}
      <footer class="mt-4">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div class="text-center text-xs md:text-sm text-label">
            © {import.meta.env.VITE_LAST_UPDATE_YEAR} Yanning Chen.
            Code available on <a class="text-accent inline-block" href="https://github.com/PhotonQuantum/landingpage">
              <SvgBrandGithub class="w-4 h-4 inline-block align-text-bottom" />
            </a>.
          </div>
        </div>
      </footer>
    </div>
  )
}