import { createElementSize } from "@solid-primitives/resize-observer";
import { Accessor, createEffect, createMemo, createSignal, JSX, splitProps } from "solid-js";
import { ViewerImageItem } from "~/data/galleryData";
import { GestureManagerState } from "~/lib/gallery/gesture";

export interface ViewerImageProps extends Omit<JSX.HTMLAttributes<HTMLImageElement>, "style"> {
  containerRef: Accessor<EventTarget & HTMLElement | undefined>;
  geometry: GestureManagerState;
  imageItems: ViewerImageItem[];
}

export default function ViewerImage(props: ViewerImageProps) {
  const [local, rest] = splitProps(props, ["geometry", "imageItems", "containerRef"]);
  const [currentImage, setCurrentImage] = createSignal<ViewerImageItem | null>(null);
  const [nextImage, setNextImage] = createSignal<ViewerImageItem | null>(null);
  const [isNextImageLoaded, setIsNextImageLoaded] = createSignal(false);

  const containerSize = createElementSize(local.containerRef);

  // Calculate required image size based on container and scale
  const requiredImageSize = createMemo(() => {
    if (!containerSize.width || !containerSize.height) return { width: 0, height: 0 };

    const scale = local.geometry.scale;

    // Calculate required size to fill the container at current scale
    const requiredWidth = containerSize.width * scale;
    const requiredHeight = containerSize.height * scale;

    return { width: requiredWidth, height: requiredHeight };
  });

  // Select the best image based on required size
  const selectedImage = createMemo(() => {
    const items = local.imageItems;
    if (!items.length) return null;

    const { width: requiredWidth, height: requiredHeight } = requiredImageSize();
    const requiredSize = Math.max(requiredWidth, requiredHeight);

    // Find the smallest image that's larger than required size, or use the largest one
    const bestImage = items.find(item =>
      Math.max(item.width, item.height) >= requiredSize
    ) || items[items.length - 1];

    return bestImage;
  });

  // Handle image loading and switching
  createEffect(() => {
    const newSelectedImage = selectedImage();
    if (!newSelectedImage) return;

    // If we don't have a current image, set it immediately
    if (!currentImage()) {
      setCurrentImage(newSelectedImage);
      return;
    }

    // If the selected image is different from current, start loading it
    if (newSelectedImage.src !== currentImage()?.src) {
      setNextImage(newSelectedImage);
      setIsNextImageLoaded(false);

      // Create a new image to preload
      console.log('Loading next image:', newSelectedImage.width, newSelectedImage.height);
      const img = new Image();
      img.onload = () => {
        setIsNextImageLoaded(true);
        setCurrentImage(newSelectedImage);
        setNextImage(null);
        console.log('Next image loaded:', newSelectedImage.width, newSelectedImage.height);
      };
      img.src = newSelectedImage.src;
    }
  });

  return (
    <img
      src={currentImage()?.src || ""}
      width={currentImage()?.width || 0}
      height={currentImage()?.height || 0}
      style={{
        "transform": `translate(${local.geometry.x}px, ${local.geometry.y}px) scale(${local.geometry.scale})`,
        "background-image": nextImage()?.src ? `url(${nextImage()?.src})` : undefined,
        "opacity": isNextImageLoaded() ? 1 : 0.99, // Slight opacity change to force repaint
      }}
      loading="lazy"
      decoding="async"
      {...rest}
    />
  )
}