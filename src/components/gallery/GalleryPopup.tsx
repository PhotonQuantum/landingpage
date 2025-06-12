import { useContext, createMemo, Component, For, createSignal, createEffect, onCleanup, onMount, JSX, splitProps, Accessor } from "solid-js";
import { GalleryGroupsContext } from "~/context/gallery";
import { ImagePointer, nextPointer, prevPointer, reverseLookupPointer } from "~/lib/gallery/pointer";
import { createGestureManager, GestureManagerState } from "~/lib/gallery/gesture";

import SvgChevronLeft from "@tabler/icons/outline/chevron-left.svg";
import SvgChevronRight from "@tabler/icons/outline/chevron-right.svg";
import { createSpring, SpringSetterOptions } from "@solid-primitives/spring";
import GalleryThumbnails from "./GalleryThumbnails";
import { lock, unlock } from "tua-body-scroll-lock";
import WebGLViewer from "./WebGLViewer";
import { createElementSize } from "@solid-primitives/resize-observer";

export interface GalleryPopupProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  pointer: ImagePointer | undefined;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onSelect: (pointer: ImagePointer) => void;
}

const oneShotTimer = (fn: () => void, delay: number) => {
  const timer = setTimeout(() => {
    fn();
    clearTimeout(timer);
  }, delay);
};

const createSpringGeometry = (geometry: Accessor<GestureManagerState>, setGeometry: (state: Partial<GestureManagerState>) => void): [Accessor<GestureManagerState>, (state: Partial<GestureManagerState>, opts?: SpringSetterOptions) => Promise<void>] => {
  const [springGeometry, setSpringGeometry] = createSpring(geometry());
  let skip = true;
  createEffect(() => {
    let localGeometry = geometry();
    if (skip) return;
    setSpringGeometry(localGeometry);
  });
  return [springGeometry, async (v, opts) => {
    skip = true;
    setGeometry(v);
    await setSpringGeometry((prev) => ({ ...prev, ...v }), opts);
    skip = false;
  }];
};

export const GalleryPopup: Component<GalleryPopupProps> = (props) => {
  const [_, others] = splitProps(props, ["pointer", "onPrev", "onNext", "onClose", "onSelect"]);

  const galleryGroups = useContext(GalleryGroupsContext)!;

  const [imgRef, setImgRef] = createSignal<EventTarget & HTMLImageElement | undefined>(undefined);
  const [containerRef, setContainerRef] = createSignal<EventTarget & HTMLElement | undefined>(undefined);
  let scrollRefs: HTMLDivElement[] = [];

  const [showTooltip, setShowTooltip] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);

  const currentImage = createMemo(() => {
    const p = props.pointer;
    if (!galleryGroups || !p) return undefined;
    return reverseLookupPointer(galleryGroups, p).image;
  });
  const currentImageItems = createMemo(() => currentImage()?.items || []);
  const currentThumbnail = createMemo(() => currentImage()?.items?.[0]?.src);

  const [pointerOverride, setPointerOverride] = createSignal<ImagePointer | undefined>(undefined);
  const imageOverride = createMemo(() => {
    const p = pointerOverride();
    if (!p) return undefined;
    return reverseLookupPointer(galleryGroups, p).image;
  });
  const metaSourceImage = createMemo(() => (imageOverride() || currentImage()));
  const exifMetadata = () => metaSourceImage()?.exif;

  const prevImage = createMemo(() => {
    const p = props.pointer;
    if (!galleryGroups || !p) return undefined;
    const prev = prevPointer(galleryGroups, p);
    if (!prev) return undefined;
    return reverseLookupPointer(galleryGroups, prev).image;
  });
  const prevImageItems = () => prevImage()?.items;

  const nextImage = createMemo(() => {
    const p = props.pointer;
    if (!galleryGroups || !p) return undefined;
    const next = nextPointer(galleryGroups, p);
    if (!next) return undefined;
    return reverseLookupPointer(galleryGroups, next).image;
  });
  const nextImageItems = () => nextImage()?.items;

  // Helper to show tooltip for a few seconds
  const triggerTooltip = () => {
    setShowTooltip(true);
    oneShotTimer(() => setShowTooltip(false), 4000);
  };

  const containerSize = createElementSize(containerRef);

  const handleNext = () => (async () => {
    if (!props.pointer) return;
    const next = nextPointer(galleryGroups, props.pointer);
    if (!next) {
      setGeometry({ scale: 1, x: 0, y: 0 });
      return;
    }
    setPointerOverride(next);
    await setGeometry({ scale: 1, x: -(containerSize.width ?? 0), y: 0 });
    props.onNext();
  })();
  const handlePrev = () => (async () => {
    if (!props.pointer) return;
    const prev = prevPointer(galleryGroups, props.pointer);
    if (!prev) {
      setGeometry({ scale: 1, x: 0, y: 0 });
      return;
    }
    setPointerOverride(prev);
    await setGeometry({ scale: 1, x: containerSize.width ?? 0, y: 0 });
    props.onPrev();
  })();

  const [imgBounds, setImgBounds] = createSignal<DOMRect | null>(null);

  const { state: geometry_, setState: setGeometry_, hovering } = createGestureManager({
    ref: imgRef,
    imgBounds: imgBounds,
    containerRef: containerRef,
    areaRef: containerRef,
    onSwipe: (direction) => {
      if (direction === "left") {
        handleNext();
      } else {
        handlePrev();
      }
    },
    onTrackpadUnreliable: triggerTooltip,
  });
  const [geometry, setGeometry] = createSpringGeometry(geometry_, setGeometry_);

  // Reset geometry and image override when current image changes
  createEffect(() => {
    currentImage(); // dependency
    setPointerOverride(undefined);
    setGeometry({ scale: 1, x: 0, y: 0 }, { hard: true });
  });

  onMount(() => {
    lock(scrollRefs);
  });

  onCleanup(() => {
    unlock(scrollRefs);
  });

  const backgroundOpacity = createMemo(() => {
    if (!containerSize.width || geometry().scale > 1) return [0, 1, 0];
    const deltaRatio = geometry().x / containerSize.width;
    return [
      Math.max(0, deltaRatio),
      Math.max(0, 1 - Math.abs(deltaRatio)),
      Math.max(0, -deltaRatio),
    ];
  }, [0, 1, 0]);
  const currentBackground = () => currentImage()?.blurhashGradient;
  const prevBackground = () => prevImage()?.blurhashGradient;
  const nextBackground = () => nextImage()?.blurhashGradient;

  return (
    <div class="fixed inset-0 z-100 flex flex-row bg-black" {...others}>
      <div class="absolute w-full h-full -z-10 mix-blend-plus-lighter" style={{ "background": currentBackground(), "opacity": backgroundOpacity()[1] }}></div>
      <div class="absolute w-full h-full -z-10 mix-blend-plus-lighter" style={{ "background": prevBackground() || currentBackground(), "opacity": backgroundOpacity()[0] }}></div>
      <div class="absolute w-full h-full -z-10 mix-blend-plus-lighter" style={{ "background": nextBackground() || currentBackground(), "opacity": backgroundOpacity()[2] }}></div>
      {/* Main image area */}
      <div class="flex-1 min-w-0 flex flex-col justify-center items-center relative">
        {/* Tooltip */}
        <div
          class={`absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/90 text-white text-sm px-4 py-2 rounded shadow-lg border border-white/10 z-50 cursor-pointer motion-safe:transition-opacity ${showTooltip() ? "opacity-100" : "opacity-0"}`}
          style={{ "pointer-events": "auto" }}
          onClick={() => setShowTooltip(false)}
        >
          Tip: Use <span class="font-bold">←/→</span> to switch images. Trackpad horizontal scroll is not always reliable.
        </div>
        <div class="relative grow w-full flex justify-center items-center overflow-hidden touch-none select-none" ref={setContainerRef}>
          <WebGLViewer
            ref={setImgRef}
            initialThumbnail={currentThumbnail()}
            containerRef={containerRef}
            geometry={geometry()}
            imageItems={currentImageItems()}
            prevImageItems={prevImageItems()}
            nextImageItems={nextImageItems()}
            class={`w-full h-full touch-none select-none`}
            onBoundingRectChange={setImgBounds}
            onLoadingChange={setIsLoading}
          />
          {/* Loading indicator */}
          <div class={`absolute bottom-8 right-8 w-12 h-12 bg-black/30 rounded-lg backdrop-blur-2xl flex items-center justify-center motion-safe:transition-opacity motion-safe:duration-200 ${isLoading() ? 'opacity-100' : 'opacity-0'}`}>
            <div class="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin shadow-2xl"></div>
          </div>
          {/* Left navigation */}
          <button class={`absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white motion-safe:transition-opacity z-20 bg-black/30 hover:bg-black/50 rounded-full cursor-pointer ${hovering() ? "opacity-100" : "opacity-0"}`} onClick={handlePrev}>
            <SvgChevronLeft class="w-6 h-6" />
          </button>
          {/* Right navigation */}
          <button class={`absolute right-5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white motion-safe:transition z-20 bg-black/30 hover:bg-black/50 rounded-full cursor-pointer ${hovering() ? "opacity-100" : "opacity-0"}`} onClick={handleNext}>
            <SvgChevronRight class="w-6 h-6" />
          </button>
        </div>
        {/* Bottom thumbnail strip */}
        <GalleryThumbnails
          ref={el => scrollRefs.push(el)}
          galleryGroups={galleryGroups}
          pointer={pointerOverride() || props.pointer}
          onSelect={props.onSelect}
        />
      </div>

      {/* Right info panel */}
      <div ref={el => scrollRefs.push(el)} class="w-[340px] shrink-0 bg-black/50 text-white p-6 overflow-y-auto flex flex-col" style={{"transform": "translate3d(0, 0, 0)"}}>
        <button class="self-end mb-2 text-white/70 hover:text-white" onClick={props.onClose}>
          <span class="text-2xl">&#10005;</span>
        </button>
        <h2 class="text-lg font-bold mb-4">Image Info</h2>
        <div class="text-sm space-y-2">
          <For each={Object.entries(exifMetadata() || {})}>{([key, value]) =>
            <div class="flex justify-between border-b border-white/10 py-1">
              <span class="text-gray-300">{key}</span>
              <span class="text-right break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
            </div>
          }</For>
        </div>
      </div>
    </div>
  );
};
