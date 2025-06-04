import { Action, createGesture, dragAction, Gesture, GestureHandlers, hoverAction, pinchAction, scrollAction, UserGestureConfig, wheelAction } from "@use-gesture/vanilla";
import { useContext, createMemo, Component, For, createSignal, createEffect, onCleanup, Accessor, untrack, onMount, Show } from "solid-js";
import { GalleryGroupsContext } from "~/context/gallery";
import { GalleryGroup } from "~/data/galleryData";
import { ImagePointer, prevPointer, nextPointer } from "~/lib/gallery/pointer";
import { enableBodyScroll, disableBodyScroll } from "body-scroll-lock";
import { createElementSize } from "@solid-primitives/resize-observer";

import SvgChevronLeft from "@tabler/icons/outline/chevron-left.svg";
import SvgChevronRight from "@tabler/icons/outline/chevron-right.svg";
import { makeTimer } from "@solid-primitives/timer";

export interface GalleryPopupProps {
  pointer: ImagePointer | undefined;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onSelect: (pointer: ImagePointer) => void;
}

// Utility to get a window of adjacent pointers
function getAdjacentPointers(
  galleryGroups: GalleryGroup[],
  pointer: ImagePointer | undefined,
  windowSize: number = 2
): ImagePointer[] {
  if (!galleryGroups || !pointer) return [];
  let pointers: ImagePointer[] = [pointer];
  // Walk backwards
  let prev = pointer;
  for (let i = 0; i < windowSize; i++) {
    const prevP = prevPointer(galleryGroups, prev);
    if (!prevP) break;
    pointers.unshift(prevP);
    prev = prevP;
  }
  // Walk forwards
  let next = pointer;
  for (let i = 0; i < windowSize; i++) {
    const nextP = nextPointer(galleryGroups, next);
    if (!nextP) break;
    pointers.push(nextP);
    next = nextP;
  }
  return pointers;
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
    document.removeEventListener('gesturestart', handler)
    document.removeEventListener('gesturechange', handler)
    document.removeEventListener('gestureend', handler)
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

interface GestureManagerState {
  scale: number;
  x: number;
  y: number;
  hovering: boolean;
}

interface GestureManagerOutput {
  state: () => GestureManagerState;
  setState: (state: Partial<GestureManagerState>) => void;
}

interface WheelMemo {
  skip: boolean;
  origin: [number, number];
}

const initWheelMemo = (origin: [number, number]) => {
  return {
    skip: false,
    origin: origin,
  }
}

const createGestureManager = (props: GestureManagerProps): GestureManagerOutput => {
  const [state, setState] = createSignal<GestureManagerState>({
    scale: 1,
    x: 0,
    y: 0,
    hovering: false,
  });
  // NOTE the whole block wheel approach does not work well.
  // Alternative solution:
  // 1. Filtered wheel event for scale = 1, only process swipe events.
  // 2. No special handling for scale > 1.
  // 3. Reliable bound calculation. Manual rubberbanding if needed.
  createGestureHandler({
    ref: props.areaRef,
    actions: [dragAction, pinchAction, hoverAction, wheelAction],
    handlers: () => {
      const container = props.containerRef();
      const target = props.ref();
      return ({
        onDrag: ({ swipe: [swipeX], offset: [x, y] }) => {
          if (swipeX) {
            props.onSwipe(swipeX > 0 ? "left" : "right");
          }
          setState((prev) => {
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
            if (untrack(state).scale <= 1 && swipe) {
              props.onSwipe(swipe);
            }
            const bounds = calcPanBounds(container!, target!);
            return {
              ...prev,
              x: Math.max(bounds.left, Math.min(bounds.right, prev.x)),
              y: Math.max(bounds.top, Math.min(bounds.bottom, prev.y)),
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
              x: Math.max(bounds.left, Math.min(bounds.right, prev.x)),
              y: Math.max(bounds.top, Math.min(bounds.bottom, prev.y)),
            }
          });
        },
        onWheel: ({ first, last, pinching, velocity: [v], movement: [x, y], memo: memo_ }) => {
          let memo: WheelMemo = memo_;
          setState((prev) => {
            if (first) memo = initWheelMemo([prev.x, prev.y]);
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
              x: memo.origin[0] - x,
              y: memo.origin[1] - y,
            }
          });
          return memo;
        },
        onWheelEnd: () => {
          const bounds = calcPanBounds(container!, target!);
          setState((prev) => ({
            ...prev,
            x: Math.max(bounds.left, Math.min(bounds.right, prev.x)),
            y: Math.max(bounds.top, Math.min(bounds.bottom, prev.y)),
          }));
        },
        onHover: ({ hovering }) => {
          setState((prev) => ({
            ...prev,
            hovering: hovering ?? false,
          }));
          if (hovering) {
            document.documentElement.style.overscrollBehaviorX = "none";
            disableBodyScroll(document.body);
          } else {
            document.documentElement.style.overscrollBehaviorX = "auto";
            enableBodyScroll(document.body);
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
    state: () => state(),
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
  const galleryGroups = useContext(GalleryGroupsContext)!;

  const [imgRef, setImgRef] = createSignal<EventTarget & HTMLImageElement | undefined>(undefined);
  const [containerRef, setContainerRef] = createSignal<EventTarget & HTMLElement | undefined>(undefined);

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

  // Use the extracted utility for thumbnail pointers
  const thumbnailPointers = createMemo(() => getAdjacentPointers(galleryGroups, props.pointer, 2));

  // Helper to show tooltip for a few seconds
  const triggerTooltip = () => {
    setShowTooltip(true);
    makeTimer(() => setShowTooltip(false), 4000, setTimeout);
  };

  const gestureManager = createGestureManager({
    ref: imgRef,
    containerRef: containerRef,
    areaRef: containerRef,
    onSwipe: (direction) => {
      if (direction === "left") props.onNext();
      else props.onPrev();
    },
    onTrackpadUnreliable: triggerTooltip,
  });

  const imgAspectRatio = createMemo(() => {
    const img = currentImageItems()[currentImageItems().length - 1];
    if (!img) return 1;
    return img.width / img.height;
  });

  createEffect(() => {
    currentImage(); // dependency
    gestureManager?.setState({ scale: 1, x: 0, y: 0 });
  });

  return (
    <div class="fixed inset-0 z-100 flex flex-row bg-black">
      <div class="absolute w-full h-full -z-10" style={{ "background": currentImage()?.blurhashGradient }}></div>
      {/* Main image area */}
      <div class="flex-1 flex flex-col justify-center items-center relative">
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
            src={currentImageItems()[currentImageItems().length - 1]?.src || ""}
            width={currentImageItems()[currentImageItems().length - 1]?.width || 0}
            height={currentImageItems()[currentImageItems().length - 1]?.height || 0}
            alt="main"
            draggable={false}
            class={`${imgAspectRatio() > containerAspectRatio() ? "w-full h-auto" : "h-full w-auto"} bg-no-repeat bg-center bg-cover touch-none select-none`}
            style={{
              "transform": `translate(${gestureManager.state().x}px, ${gestureManager.state().y}px) scale(${gestureManager.state().scale})`,
              "transition": "transform 0.2s cubic-bezier(.4,2,.6,1)",// TODO js based spring transition, and motion-safe
              "background-image": currentImageItems()[0]?.src ? `url(${currentImageItems()[0]?.src})` : undefined,
            }}
          />
          {/* Left navigation */}
          <button class={`absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white motion-safe:transition-opacity z-20 bg-black/30 hover:bg-black/50 rounded-full cursor-pointer ${gestureManager.state().hovering ? "opacity-100" : "opacity-0"}`} onClick={props.onPrev}>
            <SvgChevronLeft class="w-6 h-6" />
          </button>
          {/* Right navigation */}
          <button class={`absolute right-5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white motion-safe:transition z-20 bg-black/30 hover:bg-black/50 rounded-full cursor-pointer ${gestureManager.state().hovering ? "opacity-100" : "opacity-0"}`} onClick={props.onNext}>
            <SvgChevronRight class="w-6 h-6" />
          </button>
        </div>
        {/* Bottom thumbnail strip */}
        <div class="w-full flex flex-row justify-center gap-2 bg-black/70 backdrop-blur-3xl p-2">
          <For each={thumbnailPointers()}>{(thumbPointer) => {
            const img = galleryGroups && thumbPointer
              ? galleryGroups[thumbPointer.groupIndex].items[thumbPointer.itemIndex].images[thumbPointer.imageIndex][1]
              : undefined;
            return (
              <img
                src={img?.items?.[0]?.src || ""}
                alt={`thumb`}
                class={`h-16 w-16 object-cover rounded-xl cursor-pointer border-2 ${JSON.stringify(thumbPointer) === JSON.stringify(props.pointer) ? 'border-accent' : 'border-transparent'}`}
                onClick={() => props.onSelect(thumbPointer)}
              />
            );
          }}</For>
        </div>
      </div>

      {/* Right info panel */}
      <div class="w-[340px] bg-black/50 text-white p-6 overflow-y-auto backdrop-blur-3xl flex flex-col">
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
