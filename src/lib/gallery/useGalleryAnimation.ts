import { createSignal } from "solid-js";
import { createMediaQuery } from "@solid-primitives/media";
import { LayoutBox } from "./types";
import { identity } from "./helpers";

export function useGalleryAnimation() {
  const [prevLayoutMap, setPrevLayoutMap] = createSignal<Map<string, LayoutBox>>(new Map());
  const prefersReducedMotion = createMediaQuery("(prefers-reduced-motion: reduce)");

  const animatePositions = async (container: HTMLDivElement, layoutMap: Map<string, LayoutBox>) => {
    const elements = container.querySelectorAll('.gallery-item');

    // If reduced motion is preferred, just update positions without animation
    if (prefersReducedMotion()) {
      elements.forEach((el) => {
        const key = el.getAttribute('data-key');
        if (key) {
          const currentPos = layoutMap.get(key);
          if (currentPos) {
            (el as HTMLElement).style.transform = 'translate(0px, 0px)';
          }
        }
      });
      setPrevLayoutMap(layoutMap);
      return;
    }

    let counter = 0;
    elements.forEach((el) => {
      const key = el.getAttribute('data-key');
      if (key) {
        const prevPos = prevLayoutMap().get(key);
        const currentPos = layoutMap.get(key);

        if (prevPos && currentPos) {
          const deltaX = prevPos.left - currentPos.left;
          const deltaY = prevPos.top - currentPos.top;

          // Force a reflow.
          identity((el as HTMLElement).offsetHeight);

          if (deltaX !== 0 || deltaY !== 0) {
            counter++;
            el.animate(
              [
                { transform: `translate(${deltaX}px, ${deltaY}px)` },
                { transform: 'translate(0px, 0px)' }
              ],
              {
                duration: 800,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
              }
            );
          }
        }
      }
    });

    setPrevLayoutMap(layoutMap);
  };

  return {
    animatePositions
  };
} 