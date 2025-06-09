import { useContext, createMemo, Component, For, createSignal, createEffect, onCleanup, onMount, JSX, splitProps } from "solid-js";
import { GalleryGroupsContext } from "~/context/gallery";
import { ImagePointer } from "~/lib/gallery/pointer";
import { createGestureManager } from "~/lib/gallery/gesture";

import SvgChevronLeft from "@tabler/icons/outline/chevron-left.svg";
import SvgChevronRight from "@tabler/icons/outline/chevron-right.svg";
import { createDerivedSpring } from "@solid-primitives/spring";
import GalleryThumbnails from "./GalleryThumbnails";
import { lock, unlock } from "tua-body-scroll-lock";
import WebGLViewer from "./WebGLViewer";

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
    return galleryGroups[p.groupIndex].items[p.itemIndex].images[p.imageIndex][1];
  });
  const currentInfo = createMemo(() => currentImage() || {});
  const currentImageItems = createMemo(() => currentImage()?.items || []);
  const currentThumbnail = createMemo(() => currentImage()?.items?.[0]?.src);

  // Helper to show tooltip for a few seconds
  const triggerTooltip = () => {
    setShowTooltip(true);
    oneShotTimer(() => setShowTooltip(false), 4000);
  };

  const [imgBounds, setImgBounds] = createSignal<DOMRect | null>(null);

  const { state: geometry_, setState: setGeometry, hovering } = createGestureManager({
    ref: imgRef,
    imgBounds: imgBounds,
    containerRef: containerRef,
    areaRef: containerRef,
    onSwipe: (direction) => {
      if (direction === "left") props.onNext();
      else props.onPrev();
    },
    onTrackpadUnreliable: triggerTooltip,
  });
  const geometry = createDerivedSpring(geometry_, {
    stiffness: 0.3,
  });

  createEffect(() => {
    currentImage(); // dependency
    setGeometry({ scale: 1, x: 0, y: 0 });
  });

  onMount(() => {
    lock(scrollRefs);
  });

  onCleanup(() => {
    unlock(scrollRefs);
  });

  return (
    <div class="fixed inset-0 z-100 flex flex-row bg-black" {...others}>
      <div class="absolute w-full h-full -z-10" style={{ "background": currentImage()?.blurhashGradient }}></div>
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
            containerRef={containerRef}
            initialThumbnail={currentThumbnail()}
            geometry={geometry()}
            imageItems={currentImageItems()}
            class={`w-full h-full bg-no-repeat bg-center bg-cover touch-none select-none`}
            onBoundingRectChange={setImgBounds}
            onLoadingChange={setIsLoading}
          />
          {/* Loading indicator */}
          <div 
            class={`absolute bottom-4 right-4 w-6 h-6 border-2 border-white/30 border-t-white rounded-full motion-safe:animate-spin ${isLoading() ? 'opacity-100' : 'opacity-0'}`}
            style={{ "transition": "opacity 0.2s" }}
          />
          {/* Left navigation */}
          <button class={`absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white motion-safe:transition-opacity z-20 bg-black/30 hover:bg-black/50 rounded-full cursor-pointer ${hovering() ? "opacity-100" : "opacity-0"}`} onClick={props.onPrev}>
            <SvgChevronLeft class="w-6 h-6" />
          </button>
          {/* Right navigation */}
          <button class={`absolute right-5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white motion-safe:transition z-20 bg-black/30 hover:bg-black/50 rounded-full cursor-pointer ${hovering() ? "opacity-100" : "opacity-0"}`} onClick={props.onNext}>
            <SvgChevronRight class="w-6 h-6" />
          </button>
        </div>
        {/* Bottom thumbnail strip */}
        <GalleryThumbnails
          ref={el => scrollRefs.push(el)}
          galleryGroups={galleryGroups}
          pointer={props.pointer}
          onSelect={props.onSelect}
        />
      </div>

      {/* Right info panel */}
      <div ref={el => scrollRefs.push(el)} class="w-[340px] shrink-0 bg-black/50 text-white p-6 overflow-y-auto backdrop-blur-3xl flex flex-col">
        <button class="self-end mb-2 text-white/70 hover:text-white" onClick={props.onClose}>
          <span class="text-2xl">&#10005;</span>
        </button>
        <h2 class="text-lg font-bold mb-4">Image Info</h2>
        <div class="text-sm space-y-2">
          <For each={Object.entries(currentInfo())}>{([key, value]) =>
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
