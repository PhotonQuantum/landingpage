import { Action, createGesture, dragAction, Gesture, GestureHandlers, hoverAction, pinchAction, rubberbandIfOutOfBounds, UserGestureConfig, wheelAction } from "@use-gesture/vanilla";
import { createSignal, createEffect, onCleanup, Accessor, untrack, onMount } from "solid-js";
import { clamp } from "@solid-primitives/utils";

export interface GestureInput {
  ref: Accessor<EventTarget | undefined>;
  actions: Action[];
  handlers: Accessor<GestureHandlers>;
  config: Accessor<UserGestureConfig>;
}

export const createGestureHandler = (prop: GestureInput) => {
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

export interface GestureManagerProps {
  ref: Accessor<HTMLElement | undefined>;
  containerRef: Accessor<HTMLElement | undefined>;
  areaRef: Accessor<EventTarget | undefined>;
  onSwipe: (direction: "left" | "right") => void;
  onTrackpadUnreliable?: () => void;
}

export interface GestureManagerStateInternal {
  scale: number;
  x: number;
  y: number;
  hovering: boolean;
}

export type GestureManagerState = {
  scale: number;
  x: number;
  y: number;
}

export interface GestureManagerOutput {
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

export const createGestureManager = (props: GestureManagerProps): GestureManagerOutput => {
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
        wheel: { preventDefault: true, eventOptions: { passive: false } },
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