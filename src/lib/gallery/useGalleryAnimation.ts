import { createSignal, onCleanup } from "solid-js";
import { createMediaQuery } from "@solid-primitives/media";
import { Position } from "./types";

export function useGalleryAnimation() {
  const [prevPositions, setPrevPositions] = createSignal<Map<string, Position>>(new Map());
  const prefersReducedMotion = createMediaQuery("(prefers-reduced-motion: reduce)");

  const animatePositions = async (container: HTMLDivElement) => {
    const currentPositions = new Map();
    const elements = container.querySelectorAll('.gallery-item');
    const containerRect = container.getBoundingClientRect();

    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const key = el.getAttribute('data-key');
      if (key) {
        currentPositions.set(key, {
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top
        });
      }
    });

    // If reduced motion is preferred, just update positions without animation
    if (prefersReducedMotion()) {
      elements.forEach((el) => {
        const key = el.getAttribute('data-key');
        if (key) {
          const currentPos = currentPositions.get(key);
          if (currentPos) {
            (el as HTMLElement).style.transform = 'translate(0px, 0px)';
          }
        }
      });
      setPrevPositions(currentPositions);
      return;
    }

    // Dynamically import motion only when needed
    const { animate, easeInOut } = await import("motion");

    elements.forEach((el) => {
      const key = el.getAttribute('data-key');
      if (key) {
        const prevPos = prevPositions().get(key);
        const currentPos = currentPositions.get(key);

        if (prevPos && currentPos) {
          const deltaX = prevPos.left - currentPos.left;
          const deltaY = prevPos.top - currentPos.top;

          if (deltaX !== 0 || deltaY !== 0) {
            animate(
              el,
              {
                transform: [`translate(${deltaX}px, ${deltaY}px)`, 'translate(0px, 0px)']
              },
              {
                duration: 0.3,
                ease: easeInOut
              }
            );
          }
        }
      }
    });

    setPrevPositions(currentPositions);
  };

  return {
    animatePositions
  };
} 