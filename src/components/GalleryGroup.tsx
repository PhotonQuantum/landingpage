import { createSignal, createMemo, onCleanup, createEffect, For, batch, untrack } from "solid-js";
import justifiedLayout from "justified-layout";
import { createElementSize } from "@solid-primitives/resize-observer";
import { createIntersectionObserver } from "@solid-primitives/intersection-observer";
import { Layout } from "~/lib/gallery/types";
import { scrollToElementWithCallback } from "~/lib/gallery/utils";
import { sortImagesByFeatured, identity } from "~/lib/gallery/helpers";
import { ExifMetadata, GalleryGroup as GalleryGroupType, ImageWithBlurhash } from "~/data/galleryData";
import { GalleryImage } from "./gallery/GalleryImage";
import { GalleryHeader } from "./gallery/GalleryHeader";
import { useGalleryAnimation } from "~/lib/gallery/useGalleryAnimation";
import { createStore, reconcile } from "solid-js/store";
import { Picture } from "vite-imagetools";

interface GalleryGroupProps {
  group: GalleryGroupType;
}

export function GalleryGroup(props: GalleryGroupProps) {
  const group = untrack(() => props.group);
  const [isExpanded, setIsExpanded] = createSignal(false);
  const [isSticky, setIsSticky] = createSignal(false);
  const [isTransitioning, setIsTransitioning] = createSignal(false);

  // Refs
  let containerRef: HTMLDivElement | undefined;
  let sentinelRef: HTMLDivElement | undefined;

  // Derived state
  const containerSize = createElementSize(() => containerRef);
  const width = () => containerSize.width || 800;

  const images = group.items.flatMap(item => Object.values(item.thumbnails));
  const allFeatured = group.items.flatMap(item =>
    (item.meta.featured ?? []).map((f: string) => item.id + '/' + f.replace(/\.jpg$/i, ""))
  );
  const featuredSet = new Set(allFeatured);

  // NOTE: I didn't know modifications to the store would affect the original array! Copy it here.
  const [displayImages, setDisplayImages] = createStore(images.map(img => ({ ...img })));

  createEffect(() => {
    setDisplayImages(reconcile(isExpanded() ? images : sortImagesByFeatured(images, featuredSet), { key: "filename", merge: true }))
  })

  const displayAspectRatios = () =>
    displayImages.map((img) => img.img.w / img.img.h);

  const layout_ = createMemo(() => {
    const options = {
      containerWidth: width(),
      targetRowHeight: 220,
      boxSpacing: 8,
      maxNumRows: isExpanded() ? undefined : 3,
    };

    return justifiedLayout(displayAspectRatios(), options);
  });
  
  // NOTE intentionally not reactive.
  const initialLayout = layout_();
  const initialVisibleImages = sortImagesByFeatured(images, featuredSet).slice(0, initialLayout.boxes.length)

  const [visibleImages, setVisibleImages] = createStore<(Picture & ImageWithBlurhash & ExifMetadata)[]>(initialVisibleImages);
  const [layout, setLayout] = createStore<Layout>(initialLayout);
  createEffect(() => {
    batch(() => {
      const newLayout = layout_();
      setVisibleImages(reconcile(displayImages.slice(0, newLayout.boxes.length), { key: "filename", merge: true }));
      setLayout(newLayout);
    })
  })

  // Animation logic
  const { animatePositions } = useGalleryAnimation();

  // Update positions when layout changes
  createEffect(() => {
    // NOTE: ensure proper tracking of syncedLayout changes
    identity(layout.boxes);
    const container = containerRef;
    if (container && typeof window !== 'undefined') {
      requestAnimationFrame(() => animatePositions(container));
    }
  });

  createIntersectionObserver(
    () => sentinelRef ? [sentinelRef] : [],
    ([entry]) => {
      setIsSticky(!entry.isIntersecting);
    },
    { threshold: [0] }
  );

  // Event handlers
  const handleExpand = () => {
    const sentinel = sentinelRef;
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
    const sentinel = sentinelRef;
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
    const sentinel = sentinelRef;
    if (!sentinel) return;

    scrollToElementWithCallback(
      sentinel,
      () => { },
      { behavior: 'smooth', block: 'start' }
    );
  };

  return (
    <div>
      <div ref={el => sentinelRef = el} class="h-0 scroll-mt-16" />
      <GalleryHeader
        label={group.label}
        isExpanded={isExpanded}
        canExpand={() => images.length > layout.boxes.length}
        onExpand={handleExpand}
        onCollapse={handleCollapse}
        isSticky={isSticky}
        onHeaderClick={handleHeaderClick}
      />
      <div
        ref={el => containerRef = el}
        class="relative w-full"
        style={{ height: `${layout.containerHeight}px` }}
      >
        <For each={visibleImages}>{(image, i) => {
          return (
            <GalleryImage
              image={image}
              box={layout.boxes[i()]}
              isTransitioning={isTransitioning()}
            />
          );
        }}</For>
      </div>
    </div>
  );
} 