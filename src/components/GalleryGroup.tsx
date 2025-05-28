import { createSignal, createMemo, onCleanup, createEffect, For } from "solid-js";
import justifiedLayout from "justified-layout";
import { createElementSize } from "@solid-primitives/resize-observer";
import { createIntersectionObserver } from "@solid-primitives/intersection-observer";
import { LayoutBox } from "~/lib/gallery/types";
import { scrollToElementWithCallback } from "~/lib/gallery/utils";
import { sortImagesByFeatured } from "~/lib/gallery/helpers";
import { GalleryGroup as GalleryGroupType } from "~/apis/galleryData";
import { GalleryImage } from "./gallery/GalleryImage";
import { GalleryHeader } from "./gallery/GalleryHeader";
import { useGalleryAnimation } from "~/lib/gallery/useGalleryAnimation";

interface GalleryGroupProps {
  group: GalleryGroupType;
}

export function GalleryGroup(props: GalleryGroupProps) {
  const { group } = props;
  const [isExpanded, setIsExpanded] = createSignal(false);
  const [isSticky, setIsSticky] = createSignal(false);
  const [isTransitioning, setIsTransitioning] = createSignal(false);

  // Refs
  const [containerRef, setContainerRef] = createSignal<HTMLDivElement>();
  const [sentinelRef, setSentinelRef] = createSignal<HTMLDivElement>();

  // Derived state
  const containerSize = createElementSize(containerRef);
  const width = () => containerSize.width || 800;

  const images = group.items.flatMap(item => Object.values(item.thumbnails));
  const allFeatured: string[] = group.items.flatMap(item =>
    (item.meta.featured ?? []).map((f: string) => item.id + '/' + f.replace(/\.jpg$/i, ""))
  );
  const featuredSet: Set<string> = new Set(allFeatured);

  const visibleImages = createMemo(() =>
    isExpanded() ? images : sortImagesByFeatured(images, featuredSet)
  );

  const visibleAspectRatios = () =>
    visibleImages().map((img) => img.img.w / img.img.h);

  const layout = createMemo(() => {
    const options = {
      containerWidth: width(),
      targetRowHeight: 220,
      boxSpacing: 8,
      maxNumRows: isExpanded() ? undefined : 3,
    };

    return justifiedLayout(visibleAspectRatios(), options);
  });

  // Animation logic
  const { animatePositions } = useGalleryAnimation();

  // Update positions when layout changes
  createEffect(() => {
    layout();
    const container = containerRef();
    if (container && typeof window !== 'undefined') {
      requestAnimationFrame(() => animatePositions(container));
    }
  });

  createIntersectionObserver(
    () => sentinelRef() ? [sentinelRef()!] : [],
    ([entry]) => {
      setIsSticky(!entry.isIntersecting);
    },
    { threshold: [0] }
  );

  // Event handlers
  const handleExpand = () => {
    const sentinel = sentinelRef();
    if (!sentinel) return;

    const cleanup = scrollToElementWithCallback(
      sentinel,
      () => {
        setIsTransitioning(true);
        setIsExpanded(true);
        setTimeout(() => setIsTransitioning(false), 300);
      },
      { behavior: 'smooth', block: 'start' }
    );

    onCleanup(cleanup);
  };

  const handleCollapse = () => {
    const sentinel = sentinelRef();
    if (!sentinel) return;

    const cleanup = scrollToElementWithCallback(
      sentinel,
      () => {
        setIsTransitioning(true);
        setIsExpanded(false);
        setTimeout(() => setIsTransitioning(false), 300);
      },
      { behavior: 'smooth', block: 'start' }
    );

    onCleanup(cleanup);
  };

  const handleHeaderClick = () => {
    const sentinel = sentinelRef();
    if (!sentinel) return;

    scrollToElementWithCallback(
      sentinel,
      () => { },
      { behavior: 'smooth', block: 'start' }
    );
  };

  return (
    <div>
      <div ref={setSentinelRef} class="h-0 scroll-mt-16" />
      <GalleryHeader
        label={group.label}
        isExpanded={isExpanded}
        canExpand={() => images.length > layout().boxes.length}
        onExpand={handleExpand}
        onCollapse={handleCollapse}
        isSticky={isSticky}
        onHeaderClick={handleHeaderClick}
      />
      <div
        ref={setContainerRef}
        class="relative w-full"
        style={{ height: `${layout().containerHeight}px` }}
      >
        <For each={layout().boxes}>{(box: LayoutBox, i: () => number) => {
          // TODO deal with unstable image prop
          const image = createMemo(() => visibleImages()[i()]);
          return (
            <GalleryImage
              image={image}
              box={box}
              isTransitioning={isTransitioning()}
            />
          );
        }}</For>
      </div>
    </div>
  );
} 