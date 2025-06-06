import { createEffect, createSignal } from "solid-js";
import { createMediaQuery } from "@solid-primitives/media";
import { LayoutBox } from "./types";
import { createHydratableSignal } from "@solid-primitives/utils";

const EASING_OPT = {
  duration: 800,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
};
const SPRING_OPT = {
  duration: 830,
  easing: 'linear(0, 0.0039 0.87%, 0.0195, 0.0446, 0.0766 4.35%, 0.1546 6.68%, 0.4668 15.1%, 0.5684 18.29%, 0.648 21.19%, 0.7215, 0.7817 27.58%, 0.8339 31.06%, 0.8776 34.84%, 0.8964 36.87%, 0.9147, 0.9298, 0.9424 43.84%, 0.954, 0.9633 49.06%, 0.9723, 0.9791 55.45%, 0.9888 62.42%, 0.9949 71.13%, 0.9982 82.45%, 0.9997 99.87%)'
};

// NOTE this function now only moves animated elements to top. The actual animation is now done via css transition.
export function useGalleryAnimation() {
  const [prevLayoutMap, setPrevLayoutMap] = createSignal<Map<string, LayoutBox>>(new Map());
  const prefersReducedMotion = createMediaQuery("(prefers-reduced-motion: reduce)");

  const [supportsLinearEasing, _] = createHydratableSignal(false, () => CSS.supports('transition-timing-function', 'linear(0, 1)'))

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

    elements.forEach((el) => {
      const key = el.getAttribute('data-key');
      if (key) {
        const prevBox = prevLayoutMap().get(key);
        const currentBox = layoutMap.get(key);

        if (prevBox && currentBox) {
          const scaleX = prevBox.width / currentBox.width;
          const scaleY = prevBox.height / currentBox.height;

          const deltaW = prevBox.width - currentBox.width;
          const deltaH = prevBox.height - currentBox.height;

          const deltaX = prevBox.left - currentBox.left;
          const deltaY = prevBox.top - currentBox.top;

          // Force a reflow.
          (el as HTMLElement).style.zIndex = '30';

          if (deltaX !== 0 || deltaY !== 0) {
            const animation = el.animate(
              [
                { transform: `translate(${deltaX + deltaW / 2}px, ${deltaY + deltaH / 2}px) scale(${scaleX}, ${scaleY})` },
                { transform: 'translate(0px, 0px) scale(1, 1)' }
              ],
              supportsLinearEasing() ? SPRING_OPT : EASING_OPT
            );
            animation.onfinish = () => {
              (el as HTMLElement).style.zIndex = 'auto';
            };
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