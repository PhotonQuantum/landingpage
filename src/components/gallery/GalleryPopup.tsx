import { Action, createGesture, dragAction, Gesture, GestureHandlers, hoverAction, pinchAction, scrollAction, UserGestureConfig, wheelAction } from "@use-gesture/vanilla";
import { useContext, createMemo, Component, For, createSignal, createEffect, onCleanup, Accessor, untrack, onMount } from "solid-js";
import { GalleryGroupsContext } from "~/context/gallery";
import { GalleryGroup } from "~/data/galleryData";
import { ImagePointer, prevPointer, nextPointer } from "~/lib/gallery/pointer";
import {enableBodyScroll, disableBodyScroll} from "body-scroll-lock";

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
  ref: Accessor<EventTarget & HTMLElement | undefined>;
  containerRef: Accessor<EventTarget & HTMLElement | undefined>;
  onSwipe: (direction: "left" | "right") => void;
}

interface GestureManagerState {
  scale: number;
  x: number;
  y: number;
}

interface GestureManagerOutput {
  state: () => GestureManagerState;
  setState: (state: Partial<GestureManagerState>) => void;
}

const createGestureManager = (props: GestureManagerProps): GestureManagerOutput => {
  const [state, setState] = createSignal<GestureManagerState>({
    scale: 1,
    x: 0,
    y: 0,
  });
  // NOTE the whole block wheel approach does not work well.
  // Alternative solution:
  // 1. Filtered wheel event for scale = 1, only process swipe events.
  // 2. No special handling for scale > 1.
  // 3. Reliable bound calculation. Manual rubberbanding if needed.
  createGestureHandler({
    ref: props.ref,
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
        onWheel: ({ first, movement: [x, y], memo }) => {
          setState((prev) => {
            if (prev.scale <= 1) {
              // TODO add a tooltip telling users to use control to switch images
              return prev;
            }

            if (first) {
              memo = [prev.x, prev.y]
            }

            return {
              ...prev,
              x: memo[0] - x,
              y: memo[1] - y,
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

  const currentImage = createMemo(() => {
    const p = props.pointer;
    if (!galleryGroups || !p) return undefined;
    return galleryGroups[p.groupIndex].items[p.itemIndex].images[p.imageIndex][1];
  });
  const currentInfo = createMemo(() => currentImage() || {});
  const currentImageItems = createMemo(() => currentImage()?.items || []);

  // Use the extracted utility for thumbnail pointers
  const thumbnailPointers = createMemo(() => getAdjacentPointers(galleryGroups, props.pointer, 2));

  const gestureManager = createGestureManager({
    ref: imgRef,
    containerRef: containerRef,
    onSwipe: (direction) => {
      if (direction === "left") props.onNext();
      else props.onPrev();
    },
  });

  const aspectRatio = createMemo(() => {
    const img = currentImageItems()[currentImageItems().length - 1];
    if (!img) return 1;
    return img.width / img.height;
  });

  createEffect(() => {
    currentImage(); // dependency
    gestureManager?.setState({ scale: 1, x: 0, y: 0 });
  });

  return (
    <div class="fixed inset-0 z-100 flex flex-row bg-black/80">
      {/* Left navigation */}
      <button class="w-12 flex items-center justify-center text-white/70 hover:text-white transition" onClick={props.onPrev}>
        <span class="text-3xl">&#8592;</span>
      </button>

      {/* Main image area */}
      <div class="flex-1 flex flex-col justify-center items-center relative" ref={setContainerRef}>
        <img
          ref={setImgRef}
          src={currentImageItems()[currentImageItems().length - 1]?.src || ""}
          width={currentImageItems()[currentImageItems().length - 1]?.width || 0}
          height={currentImageItems()[currentImageItems().length - 1]?.height || 0}
          alt="main"
          draggable={false}
          class={`${aspectRatio() > 1 ? "w-full h-auto" : "h-full w-auto"} rounded shadow-lg object-contain bg-black touch-none select-none`}
          style={{
            "transform": `translate(${gestureManager.state().x}px, ${gestureManager.state().y}px) scale(${gestureManager.state().scale})`,
            "transition": "transform 0.2s cubic-bezier(.4,2,.6,1)"
          }}
        />
        {/* Bottom thumbnail strip */}
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-row gap-2 bg-black/60 rounded p-2">
          <For each={thumbnailPointers()}>{(thumbPointer) => {
            const img = galleryGroups && thumbPointer
              ? galleryGroups[thumbPointer.groupIndex].items[thumbPointer.itemIndex].images[thumbPointer.imageIndex][1]
              : undefined;
            return (
              <img
                src={img?.items?.[0]?.src || ""}
                alt={`thumb`}
                class={`h-16 w-16 object-cover rounded cursor-pointer border-2 ${JSON.stringify(thumbPointer) === JSON.stringify(props.pointer) ? 'border-accent' : 'border-transparent'}`}
                onClick={() => props.onSelect(thumbPointer)}
              />
            );
          }}</For>
        </div>
      </div>

      {/* Right info panel */}
      <div class="w-[340px] bg-gradient-to-l from-black/80 to-black/30 text-white p-6 overflow-y-auto flex flex-col">
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

      {/* Right navigation */}
      <button class="w-12 flex items-center justify-center text-white/70 hover:text-white transition" onClick={props.onNext}>
        <span class="text-3xl">&#8594;</span>
      </button>
    </div>
  );
};
