import SvgGhost3 from "@tabler/icons/outline/ghost-3.svg"

export default function NotFound() {
  return (
    <main class="text-center mx-auto my-auto text-strong flex items-center gap-2">
      <SvgGhost3 class="w-20 h-20 stroke-[0.8]" />
      <div class="text-start flex flex-col gap-1">
        <h1 class="text-2xl font-semibold">404</h1>
        <p class="text">This page could not be found.</p>
      </div>
    </main>
  );
}
