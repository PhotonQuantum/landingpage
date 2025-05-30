import { createSignal, onCleanup, createEffect } from "solid-js";

interface UseTapOrClickOptions {
  onTap: () => void;
  tapTimeout?: number; // ms, default 3000
  closeOnOutside?: boolean;
}

export function useTapOrClick(options: UseTapOrClickOptions) {
  const [overlayActive, setOverlayActive] = createSignal(false);
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let timeoutId: number | undefined;
  let el: HTMLElement | null = null;
  const TAP_MAX_MOVEMENT = 10; // px
  const TAP_MAX_DURATION = 400; // ms
  const tapTimeout = options.tapTimeout ?? 3000;

  // Helper to detect touch device
  const isTouchDevice = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  function handleTouchStart(e: TouchEvent) {
    if (!isTouchDevice()) return;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
  }

  function handleTouchEnd(e: TouchEvent) {
    if (!isTouchDevice()) return;
    const touch = e.changedTouches[0];
    const dx = Math.abs(touch.clientX - touchStartX);
    const dy = Math.abs(touch.clientY - touchStartY);
    const dt = Date.now() - touchStartTime;
    if (dx < TAP_MAX_MOVEMENT && dy < TAP_MAX_MOVEMENT && dt < TAP_MAX_DURATION) {
      // It's a tap
      if (!overlayActive()) {
        setOverlayActive(true);
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => setOverlayActive(false), tapTimeout);
      } else {
        setOverlayActive(false);
        options.onTap();
      }
      e.preventDefault();
    }
  }

  function handleClick(e: MouseEvent) {
    if (isTouchDevice()) {
      // On touch, click is handled by touch logic
      e.preventDefault();
      return;
    }
    options.onTap();
  }

  // Outside click/touch logic
  function onDocumentPointerDown(e: Event) {
    if (!el) return;
    if (el.contains(e.target as Node)) return;
    setOverlayActive(false);
  }

  // Watch overlayActive and add/remove listeners
  const cleanupFns: (() => void)[] = [];
  function setupOutsideListener() {
    if (!options.closeOnOutside) return;
    if (typeof window === 'undefined') return;
    // Listen for both touchstart and mousedown
    document.addEventListener('touchstart', onDocumentPointerDown, true);
    document.addEventListener('mousedown', onDocumentPointerDown, true);
    cleanupFns.push(() => {
      document.removeEventListener('touchstart', onDocumentPointerDown, true);
      document.removeEventListener('mousedown', onDocumentPointerDown, true);
    });
  }

  function cleanupOutsideListener() {
    while (cleanupFns.length) cleanupFns.pop()?.();
  }

  // React to overlayActive
  createEffect(() => {
    cleanupOutsideListener();
    if (overlayActive()) setupOutsideListener();
  });

  onCleanup(() => {
    clearTimeout(timeoutId);
    cleanupOutsideListener();
  });

  // Return event handlers, overlayActive signal, and setRef
  return {
    bind: {
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
      onClick: handleClick,
    },
    overlayActive,
    setOverlayActive,
    setRef: (node: HTMLElement | null) => { el = node; },
  };
} 