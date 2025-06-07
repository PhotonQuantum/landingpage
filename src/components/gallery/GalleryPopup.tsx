import { Action, Bounds, createGesture, dragAction, Gesture, GestureHandlers, hoverAction, pinchAction, rubberbandIfOutOfBounds, UserGestureConfig, wheelAction } from "@use-gesture/vanilla";
import { useContext, createMemo, Component, For, createSignal, createEffect, onCleanup, Accessor, untrack, onMount, JSX, splitProps } from "solid-js";
import { GalleryGroupsContext } from "~/context/gallery";
import { ImagePointer } from "~/lib/gallery/pointer";
import { createElementSize } from "@solid-primitives/resize-observer";

import SvgChevronLeft from "@tabler/icons/outline/chevron-left.svg";
import SvgChevronRight from "@tabler/icons/outline/chevron-right.svg";
import { makeTimer } from "@solid-primitives/timer";
import { createDerivedSpring } from "@solid-primitives/spring";
import GalleryThumbnails from "./GalleryThumbnails";
import { lock, unlock } from "tua-body-scroll-lock";
import { clamp } from "@solid-primitives/utils";

export interface GalleryPopupProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  pointer: ImagePointer | undefined;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onSelect: (pointer: ImagePointer) => void;
}

interface GestureInput {
  ref: Accessor<EventTarget | undefined>;
  actions: Action[];
  handlers: Accessor<GestureHandlers>;
  config: Accessor<UserGestureConfig>;
}

const createGestureHandler = (prop: GestureInput) => {
  const [gesture, setGesture] = createSignal<Gesture | undefined>(undefined);
  const Gesture = createGesture(prop.actions);

  const handler = (e: Event) => e.preventDefault();

  createEffect((prev: Gesture | undefined) => {
    const localRef = prop.ref();
    if (!localRef) return;
    if (prev) {
      prev.destroy();
    }
    const g = Gesture(localRef, prop.handlers(), prop.config());
    setGesture(g);
    return g;
  })

  onMount(() => {
    document.addEventListener('gesturestart', handler)
    document.addEventListener('gesturechange', handler)
    document.addEventListener('gestureend', handler)
  });

  onCleanup(() => {
    if (gesture()) {
      gesture()?.destroy();
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('gesturestart', handler)
      document.removeEventListener('gesturechange', handler)
      document.removeEventListener('gestureend', handler)
    }
  })

  return gesture;
}

interface GestureManagerProps {
  ref: Accessor<HTMLElement | undefined>;
  containerRef: Accessor<HTMLElement | undefined>;
  areaRef: Accessor<EventTarget | undefined>;
  onSwipe: (direction: "left" | "right") => void;
  onTrackpadUnreliable?: () => void;
}

interface GestureManagerStateInternal {
  scale: number;
  x: number;
  y: number;
  hovering: boolean;
}

type GestureManagerState = {
  scale: number;
  x: number;
  y: number;
}

interface GestureManagerOutput {
  hovering: Accessor<boolean>;
  state: Accessor<GestureManagerState>;
  setState: (state: Partial<GestureManagerState>) => void;
}

interface WheelMemo {
  skip: boolean;
  origin: [number, number];
  bounds: { left: number, top: number, right: number, bottom: number }
}

const initWheelMemo = (origin: [number, number], container: HTMLElement, target: HTMLElement) => {
  const bounds = calcPanBounds(container, target);
  return {
    skip: false,
    origin: origin,
    bounds: bounds,
  }
}

const createGestureManager = (props: GestureManagerProps): GestureManagerOutput => {
  const [state, setState] = createSignal<GestureManagerStateInternal>({
    scale: 1,
    x: 0,
    y: 0,
    hovering: false,
  });
  createGestureHandler({
    ref: props.areaRef,
    actions: [dragAction, pinchAction, hoverAction, wheelAction],
    handlers: () => {
      const container = props.containerRef();
      const target = props.ref();
      return ({
        onDrag: ({ pinching, cancel, swipe: [swipeX], offset: [x, y] }) => {
          if (pinching) {
            cancel();
            return;
          }
          setState((prev) => {
            if (prev.scale <= 1 && swipeX) {
              props.onSwipe(swipeX > 0 ? "left" : "right");
            }
            return {
              ...prev,
              x: x,
              y: prev.scale > 1 ? y : 0,
            }
          })
        },
        onDragEnd: () => {
          setState((prev) => {
            const swipe = panSwipeIntention(target!, prev.x, prev.y);
            if (prev.scale <= 1 && swipe) {
              props.onSwipe(swipe);
            }
            const bounds = calcPanBounds(container!, target!);
            return {
              ...prev,
              x: clamp(prev.x, bounds.left, bounds.right),
              y: clamp(prev.y, bounds.top, bounds.bottom),
            }
          });
        },
        onPinch: ({ origin: [ox, oy], first, movement: [ms], offset: [s], memo }) => {
          if (first) {
            const { width, height, x, y } = target!.getBoundingClientRect()
            const tx = ox - (x + width / 2)
            const ty = oy - (y + height / 2)
            memo = [state().x, state().y, tx, ty]
          }

          const x = memo[0] - (ms - 1) * memo[2]
          const y = memo[1] - (ms - 1) * memo[3]
          setState((prev) => ({
            ...prev,
            scale: s,
            x: x,
            y: y,
          }));
          return memo;
        },
        onPinchEnd: () => {
          setState((prev) => {
            const bounds = calcPanBounds(container!, target!);
            return {
              ...prev,
              x: clamp(prev.x, bounds.left, bounds.right),
              y: clamp(prev.y, bounds.top, bounds.bottom),
            }
          });
        },
        onWheel: ({ first, last, pinching, velocity: [v], movement: [x, y], memo: memo_ }) => {
          let memo: WheelMemo = memo_;
          setState((prev) => {
            if (first) {
              memo = initWheelMemo([prev.x, prev.y], container!, target!);
            }
            if (pinching || memo.skip) return prev;

            if (prev.scale <= 1 && !last) {
              if (Math.abs(x) > 50 && Math.abs(v) > 2) {
                // Intentional swipe
                const direction = x > 0 ? "left" : "right";
                props.onSwipe(direction);
                if (props.onTrackpadUnreliable) props.onTrackpadUnreliable();
                memo.skip = true; // Prevent further wheel events
                return prev;
              }
              return prev;
            }

            return {
              ...prev,
              x: rubberbandIfOutOfBounds(memo.origin[0] - x, memo.bounds.left, memo.bounds.right),
              y: rubberbandIfOutOfBounds(memo.origin[1] - y, memo.bounds.top, memo.bounds.bottom),
            }
          });
          return memo;
        },
        onWheelEnd: () => {
          setState((prev) => {
            const bounds = calcPanBounds(container!, target!);
            return {
              ...prev,
              x: clamp(prev.x, bounds.left, bounds.right),
              y: clamp(prev.y, bounds.top, bounds.bottom),
            }
          });
        },
        onHover: ({ hovering }) => {
          setState((prev) => ({
            ...prev,
            hovering: hovering ?? false,
          }));
          if (hovering) {
            document.documentElement.style.overscrollBehaviorX = "none";
          } else {
            document.documentElement.style.overscrollBehaviorX = "auto";
          }
        },
      });
    },
    config: () => {
      const container = props.containerRef();
      const target = props.ref();

      return {
        drag: {
          from: () => [untrack(state).x, untrack(state).y],
          bounds: () => {
            const bounds = calcPanBounds(container!, target!);
            if (untrack(state).scale <= 1) {
              return {
                top: bounds.top,
                bottom: bounds.bottom,
              }
            } else {
              return bounds
            }
          },
          preventDefault: true,
          rubberband: true,
        },
        pinch: { scaleBounds: { min: 1, max: 5 }, rubberband: true },
        scroll: { preventDefault: true },
        wheel: { preventDefault: true },
      }
    },
  });
  return {
    hovering: () => state().hovering,
    state: () => ({
      scale: state().scale,
      x: state().x,
      y: state().y,
    }),
    setState: (state: Partial<GestureManagerState>) => setState((prev) => ({ ...prev, ...state })),
  };
}

const panSwipeIntention = (target: HTMLElement, x: number, y: number) => {
  const { width: tWidth } = target.getBoundingClientRect();
  if (x > tWidth / 2) {
    return "right";
  } else if (x < -tWidth / 2) {
    return "left";
  } else {
    return undefined;
  }
}

const calcPanBounds = (container: HTMLElement, target: HTMLElement) => {
  const { width, height } = container.getBoundingClientRect();
  const { width: tWidth, height: tHeight } = target.getBoundingClientRect();
  return {
    left: Math.min(0, (width - tWidth) / 2),
    top: Math.min(0, (height - tHeight) / 2),
    right: -Math.min(0, (width - tWidth) / 2),
    bottom: -Math.min(0, (height - tHeight) / 2),
  }
}

export const GalleryPopup: Component<GalleryPopupProps> = (props) => {
  const [_, others] = splitProps(props, ["pointer", "onPrev", "onNext", "onClose", "onSelect"]);

  const galleryGroups = useContext(GalleryGroupsContext)!;

  const [imgRef, setImgRef] = createSignal<EventTarget & HTMLImageElement | undefined>(undefined);
  const [containerRef, setContainerRef] = createSignal<EventTarget & HTMLElement | undefined>(undefined);
  let scrollRefs: HTMLDivElement[] = [];

  const containerSize = createElementSize(containerRef);
  const containerAspectRatio = createMemo(() => (containerSize.width ?? 1) / (containerSize.height ?? 1));

  const [showTooltip, setShowTooltip] = createSignal(false);

  const currentImage = createMemo(() => {
    const p = props.pointer;
    if (!galleryGroups || !p) return undefined;
    return galleryGroups[p.groupIndex].items[p.itemIndex].images[p.imageIndex][1];
  });
  const currentInfo = createMemo(() => currentImage() || {});
  const currentImageItems = createMemo(() => currentImage()?.items || []);

  // Helper to show tooltip for a few seconds
  const triggerTooltip = () => {
    setShowTooltip(true);
    makeTimer(() => setShowTooltip(false), 4000, setTimeout);
  };

  const { state: geometry_, setState: setGeometry, hovering } = createGestureManager({
    ref: imgRef,
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

  const imgAspectRatio = createMemo(() => {
    const img = currentImageItems()[currentImageItems().length - 1];
    if (!img) return 1;
    return img.width / img.height;
  });

  // Calculate required image size based on container and scale
  const requiredImageSize = createMemo(() => {
    const container = containerRef();
    if (!container) return { width: 0, height: 0 };
    
    const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();
    const scale = geometry().scale;
    
    // Calculate required size to fill the container at current scale
    const requiredWidth = containerWidth * scale;
    const requiredHeight = containerHeight * scale;
    
    return { width: requiredWidth, height: requiredHeight };
  });

  // Select the best image based on required size
  const selectedImage = createMemo(() => {
    const items = currentImageItems();
    if (!items.length) return null;
    
    const { width: requiredWidth, height: requiredHeight } = requiredImageSize();
    const requiredSize = Math.max(requiredWidth, requiredHeight);
    
    // Find the smallest image that's larger than required size
    let bestImage = items[items.length - 1]; // Default to largest image
    for (const item of items) {
      const itemSize = Math.max(item.width, item.height);
      if (itemSize >= requiredSize) {
        bestImage = item;
        break;
      }
    }
    
    return bestImage;
  });

  // Log selected image dimensions when they change
  createEffect(() => {
    const image = selectedImage();
    if (image) {
      console.log('Selected image:', {
        width: image.width,
        height: image.height
      });
    }
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
        <div class="relative grow w-full flex justify-center items-center overflow-hidden" ref={setContainerRef}>
          <img
            ref={setImgRef}
            src={selectedImage()?.src || ""}
            width={selectedImage()?.width || 0}
            height={selectedImage()?.height || 0}
            alt="main"
            draggable={false}
            class={`${imgAspectRatio() > containerAspectRatio() ? "w-full h-auto" : "h-full w-auto"} bg-no-repeat bg-center bg-cover touch-none select-none`}
            style={{
              "transform": `translate(${geometry().x}px, ${geometry().y}px) scale(${geometry().scale})`,
              "background-image": currentImageItems()[0]?.src ? `url(${currentImageItems()[0]?.src})` : undefined,
            }}
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
