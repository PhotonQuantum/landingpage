export function scrollToElementWithCallback(
  element: HTMLElement,
  callback: () => void,
  options?: boolean | ScrollIntoViewOptions
): () => void {
  if (typeof window === 'undefined') return () => { };

  const eventListenerCB = () => {
    clearTimeout(timer);
    timer = setTimeout(timerCB, 50);
  };

  const timerCB = () => {
    callback();
    document.removeEventListener("scroll", eventListenerCB);
  };

  let timer = setTimeout(timerCB, 50);
  document.addEventListener("scroll", eventListenerCB);
  element.scrollIntoView(options);

  // Return cleanup function
  return () => {
    clearTimeout(timer);
    document.removeEventListener("scroll", eventListenerCB);
  };
}

// SolidJS directive: use:clickOutside
export function clickOutside(el: HTMLElement, accessor: () => (e: MouseEvent) => void) {
  const handler = (e: MouseEvent) => {
    if (!el.contains(e.target as Node)) {
      accessor()?.(e);
    }
  };
  document.addEventListener("mousedown", handler);
  return {
    destroy() {
      document.removeEventListener("mousedown", handler);
    }
  };
}

export const dateWithOffset = (date: Date, offset?: string) => {
  if (offset) {
    const iso = date.toISOString().replace(/Z|[+-]\d{2}:\d{2}$/, offset);
    return new Date(iso);
  } else {
    return date;
  }
}


export function getMonthName(month: number, locale?: string) {
  return new Date(0, month - 1).toLocaleString(locale, { month: "long" });
}

declare module "solid-js" {
  namespace JSX {
    interface Directives {
      clickOutside: (e: MouseEvent) => void;
    }
  }
}