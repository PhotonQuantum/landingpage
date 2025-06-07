import { createElementSize } from "@solid-primitives/resize-observer";
import { Accessor, createEffect, createMemo, JSX, splitProps } from "solid-js";
import { ViewerImageItem } from "~/data/galleryData";
import { GestureManagerState } from "~/lib/gallery/gesture";

export interface ViewerImageProps extends Omit<JSX.HTMLAttributes<HTMLImageElement>, "style"> {
  containerRef: Accessor<EventTarget & HTMLElement | undefined>;
  geometry: GestureManagerState;
  imageItems: ViewerImageItem[];
}

export default function ViewerImage(props: ViewerImageProps) {
  const [local, rest] = splitProps(props, ["geometry", "imageItems", "containerRef"]);

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

  // Log selected image dimensions when they change
  createEffect(() => {
    const image = selectedImage();
    if (image) {
      console.log('Selected image:', {
        width: image.width,
        height: image.height
      });
    }
  });

  return (
    <img
      src={selectedImage()?.src || ""}
      width={selectedImage()?.width || 0}
      height={selectedImage()?.height || 0}
      style={{
        "transform": `translate(${local.geometry.x}px, ${local.geometry.y}px) scale(${local.geometry.scale})`,
        "background-image": local.imageItems[0].src ? `url(${local.imageItems[0].src})` : undefined,
      }}
      loading="lazy"
      decoding="async"
      {...rest}
    />
  )
}