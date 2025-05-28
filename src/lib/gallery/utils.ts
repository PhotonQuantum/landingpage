export function scrollToElementWithCallback(
  element: HTMLElement,
  callback: () => void,
  options?: boolean | ScrollIntoViewOptions
): () => void {
  if (typeof window === 'undefined') return () => {};

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