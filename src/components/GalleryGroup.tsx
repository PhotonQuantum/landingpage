import { createSignal, createMemo, createEffect, For, batch, untrack, Accessor, onMount } from "solid-js";
import justifiedLayout from "justified-layout";
import { createElementSize } from "@solid-primitives/resize-observer";
import { createIntersectionObserver } from "@solid-primitives/intersection-observer";
import { Layout, positionLike } from "~/lib/gallery/types";
import { scrollToElementWithCallback } from "~/lib/gallery/utils";
import { sortImagesByFeatured } from "~/lib/gallery/helpers";
import { ExifMetadata, GalleryGroup as GalleryGroupType, ImageWithBlurhash } from "~/data/galleryData";
import { GalleryImage } from "./gallery/GalleryImage";
import { GalleryHeader } from "./gallery/GalleryHeader";
import { useGalleryAnimation } from "~/lib/gallery/useGalleryAnimation";
import { createStore, reconcile } from "solid-js/store";
import { Picture } from "vite-imagetools";
import { TransitionGroup } from "solid-transition-group";
import { Dynamic } from "solid-js/web";
import { createMediaQuery } from "@solid-primitives/media";

interface GalleryGroupProps {
  group: GalleryGroupType;
}

interface GalleryReducerOutput {
  isExpanded: Accessor<boolean>;
  visibleImages: (Picture & ImageWithBlurhash & ExifMetadata)[];
  layout: Layout;
}

interface GalleryReducerAction {
  setIsExpanded: (isExpanded: boolean) => void;
}

const galleryReducer = (
  containerRef: Accessor<HTMLDivElement | undefined>,
  images: (Picture & ImageWithBlurhash & ExifMetadata)[],
  featuredSet: Set<string>,
): [GalleryReducerOutput, GalleryReducerAction] => {
  const containerSize = createElementSize(containerRef);
  const width = () => containerSize.width || 800;

  const [isExpanded, setIsExpanded] = createSignal(false);

  const initialDisplayImages = sortImagesByFeatured(images, featuredSet);
  const [displayImages, setDisplayImages] = createStore(initialDisplayImages.map(img => ({ ...img })));

  const layout_ = (isExpanded: boolean, images: (Picture & ImageWithBlurhash & ExifMetadata)[]) => {
    const aspectRatios = images.map((img) => img.img.w / img.img.h);

    const options = {
      containerWidth: width(),
      targetRowHeight: 220,
      boxSpacing: 8,
      maxNumRows: isExpanded ? undefined : 3,
    };

    return justifiedLayout(aspectRatios, options);
  };

  // NOTE intentionally not reactive.
  const initialLayout = layout_(false, initialDisplayImages);
  const initialVisibleImages = initialDisplayImages.slice(0, initialLayout.boxes.length)

  const [visibleImages, setVisibleImages] = createStore<(Picture & ImageWithBlurhash & ExifMetadata)[]>(initialVisibleImages);
  const [layout, setLayout] = createStore<Layout>(initialLayout);

  let ignoreOnce = false;
  createEffect(() => {
    batch(() => {
      if (ignoreOnce) {
        ignoreOnce = false;
        return;
      }

      const newLayout = layout_(isExpanded(), displayImages);
      setVisibleImages(reconcile(displayImages.slice(0, newLayout.boxes.length), { key: "filename", merge: true }));
      setLayout(newLayout);
    })
  })

  const setIsExpanded_ = (isExpanded: boolean) => {
    batch(() => {
      setIsExpanded(isExpanded);
      const newDisplayImages = reconcile(isExpanded ? images : sortImagesByFeatured(images, featuredSet), { key: "filename", merge: true })(displayImages);
      const newLayout = layout_(isExpanded, newDisplayImages);
      setDisplayImages(newDisplayImages);
      setVisibleImages(reconcile(newDisplayImages.slice(0, newLayout.boxes.length), { key: "filename", merge: true }));
      setLayout(newLayout);

      // Do not fire this effect again when isExpanded changes. Can cause animation broken.
      ignoreOnce = true;
    })
  }

  return [{
    isExpanded,
    visibleImages,
    layout,
  }, {
    setIsExpanded: setIsExpanded_,
  }
  ];
}

export function GalleryGroup(props: GalleryGroupProps) {
  const group = untrack(() => props.group);
  const [isSticky, setIsSticky] = createSignal(false);
  const prefersReducedMotion = createMediaQuery("(prefers-reduced-motion: reduce)");

  // Refs
  let containerRef: HTMLDivElement | undefined;
  let sentinelRef: HTMLDivElement | undefined;

  const images = group.items.flatMap(item => Object.values(item.thumbnails));
  const allFeatured = group.items.flatMap(item =>
    (item.meta.featured ?? []).map((f: string) => item.id + '/' + f.replace(/\.jpg$/i, ""))
  );
  const featuredSet = new Set(allFeatured);

  const [{ isExpanded, visibleImages, layout }, { setIsExpanded }] = galleryReducer(() => containerRef, images, featuredSet);

  const layoutMap = createMemo(() => new Map(layout.boxes.map((box, i) => [visibleImages[i].filename, box])), new Map());

  // Animation logic
  const { animatePositions } = useGalleryAnimation();

  // Update positions when layout changes
  createEffect(() => {
    const container = containerRef;
    if (container && typeof window !== 'undefined') {
      const localLayoutMap = layoutMap();
      requestAnimationFrame(() => {
        animatePositions(container, localLayoutMap);
      });
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

    scrollToElementWithCallback(
      sentinel,
      () => {
        setIsExpanded(true);
      },
      { behavior: 'smooth', block: 'start' }
    );
  };

  const handleCollapse = () => {
    const sentinel = sentinelRef;
    if (!sentinel) return;

    scrollToElementWithCallback(
      sentinel,
      () => {
        setIsExpanded(false);
      },
      { behavior: 'smooth', block: 'start' }
    );
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

  // Layout mode: 'grid' for SSR, 'justified' for client
  const [layoutMode, setLayoutMode] = createSignal<'grid' | 'justified'>("grid");
  onMount(() => {
    setLayoutMode("justified");
  });

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
        class={layoutMode() === 'justified' ? 'relative w-full' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2'}
        style={layoutMode() === 'justified' ? { height: `${layout.containerHeight}px` } : {}}
      >
        <Dynamic component={prefersReducedMotion() ? "div" : TransitionGroup} name="fade">
          <For each={visibleImages}>{(image, i) => (
            <GalleryImage
              image={image}
              box={layoutMode() === 'justified' ? layout.boxes[i()] : positionLike(layout.boxes[i()])}
              mode={layoutMode()}
            />
          )}</For>
        </Dynamic>
      </div>
    </div>
  );
} 