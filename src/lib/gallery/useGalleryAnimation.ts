import { createSignal } from "solid-js";
import { createMediaQuery } from "@solid-primitives/media";
import { LayoutBox } from "./types";

// NOTE this function now only moves animated elements to top. The actual animation is now done via css transition.
export function useGalleryAnimation() {
  const [prevLayoutMap, setPrevLayoutMap] = createSignal<Map<string, LayoutBox>>(new Map());
  const prefersReducedMotion = createMediaQuery("(prefers-reduced-motion: reduce)");

  const animatePositions = async (container: HTMLDivElement, layoutMap: Map<string, LayoutBox>) => {
    const elements = container.querySelectorAll('.gallery-item');

    if (prefersReducedMotion()) return;

    elements.forEach((el) => {
      const key = el.getAttribute('data-key');
      if (key) {
        const prevPos = prevLayoutMap().get(key);
        const currentPos = layoutMap.get(key);

        if (prevPos && currentPos) {
          (el as HTMLElement).style.zIndex = '30';
        }
      }
    });

    setPrevLayoutMap(layoutMap);
  };

  return {
    animatePositions
  };
} 