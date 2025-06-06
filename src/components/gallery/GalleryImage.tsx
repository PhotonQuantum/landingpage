import { Component, createMemo, createSignal, For, Show, splitProps } from "solid-js";
import type { JSX } from "solid-js";
import { Picture } from "vite-imagetools";
import { LayoutBox } from "~/lib/gallery/types";
import { ExifMetadata, ImageWithBlurhash } from "~/data/galleryData";
import SvgAperture from "@tabler/icons/outline/aperture.svg"
import SvgEye from "@tabler/icons/outline/eye.svg"
import SvgStopwatch from "@tabler/icons/outline/stopwatch.svg"
import { useTapOrClick } from "~/lib/gallery/useTapOrClick";
import { createLocale } from "~/lib/gallery/createLocale";
import { dateWithOffset } from "~/lib/gallery/utils";

const dateOptions: Intl.DateTimeFormatOptions = {
  month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit'
};

interface GalleryImageProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> {
  image: Picture & ImageWithBlurhash & ExifMetadata;
  box: LayoutBox;
  mode: 'grid' | 'justified';
  willChange?: boolean;
  onClick: () => void;
}

export const GalleryImage: Component<GalleryImageProps> = (props) => {
  const image = () => props.image;
  const box = createMemo(() => props.box);
  const mode = createMemo(() => props.mode);

  const [_, others] = splitProps(props, ["image", "box", "mode", "onClick", "class", "willChange"]);

  const [isLoaded, setIsLoaded] = createSignal(false);
  const tap = useTapOrClick({
    onTap: () => {
      props.onClick();
    },
    tapTimeout: 3000,
    closeOnOutside: true,
  });

  const locale = createLocale();

  const dateTimeLabel = () => {
    const localImage = image();
    if (!localImage.exif.Photo?.DateTimeOriginal) return undefined;
    const dt = new Date(localImage.exif.Photo.DateTimeOriginal);
    const offset = localImage.exif.Photo.OffsetTimeOriginal;
    const dtOffset = dateWithOffset(dt, offset);
    return dtOffset.toLocaleString(locale(), dateOptions);
  }

  // Helper to format exposure time
  function formatExposureTime(exposure: number | undefined): string {
    if (!exposure) return '';
    if (exposure >= 1) return exposure.toFixed(1);
    // For values < 1, show as 1/x
    return `1/${Math.round(1 / exposure)}`;
  }

  // Style for the image container
  const containerStyle = (): JSX.CSSProperties =>
    mode() === 'justified'
      ? {
        position: 'absolute',
        left: `${box().left}px`,
        top: `${box().top}px`,
        width: `${box().width}px`,
        height: `${box().height}px`,
      }
      : {
        position: 'static',
        width: '100%',
      };

  return (
    <div
      ref={tap.setRef}
      class={`gallery-item overflow-hidden rounded-xs cursor-pointer ${mode() === 'justified' ? 'absolute' : 'relative aspect-[4/3]'} ${props.class} ${props.willChange ? 'will-change-transform' : ''}`}
      data-key={image().filename}
      style={containerStyle()}
      {...tap.bind}
      {...others}
    >
      <div class={`relative w-full h-full group${tap.overlayActive() ? ' overlay-active' : ''}`}>
        {image().blurhashGradient && !isLoaded() && (
          <div
            class="absolute inset-0 w-full h-full rounded-xs motion-safe:animate-pulse"
            style={{
              background: image().blurhashGradient
            }}
          />
        )}
        <div
          class={`absolute inset-0 w-full h-full ${isLoaded() ? 'opacity-100' : 'opacity-0'}`}
        >
          <img
            sizes={`${box().width}px`}
            srcset={image().sources.webp}
            src={image().img.src}
            alt={image().filename}
            class="absolute inset-0 w-full h-full object-cover rounded-xs transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            decoding="async"
            onLoad={() => setIsLoaded(true)}
          />
        </div>
        {/* Gradient overlay as sibling */}
        <div class={`absolute inset-0 rounded-xs pointer-events-none opacity-0 group-hover:opacity-100 ${tap.overlayActive() ? '!opacity-100' : ''} motion-safe:transition-opacity motion-safe:duration-200 motion-reduce:transition-none bg-gradient-to-t from-black/90 via-black/10 via-50% to-black/0 to-100%`}></div>
        {/* Metadata overlay as sibling */}
        <div class="absolute inset-0 flex flex-col justify-end rounded-xs pointer-events-none">
          <div class="relative z-10 p-2 text-white text-sm">
            <Show when={dateTimeLabel()}>{(label) => (
              <div class={`inline-flex items-center gap-1 text-white whitespace-nowrap px-3 py-1 text-xs font-mono opacity-0 group-hover:opacity-100 ${tap.overlayActive() ? '!opacity-100' : ''} motion-safe:transition-opacity motion-safe:duration-200 motion-reduce:transition-none border-b border-white/50 pb-0.5`}>
                {label()}
              </div>
            )}</Show>
            <div class="flex flex-wrap flex-row gap-0.5 mt-1">
              <div class="flex basis-[11rem] flex-grow flex-wrap gap-0.5 flex-row">
                <span class={`basis-[5rem] flex-grow flex items-center gap-1 whitespace-nowrap backdrop-blur-sm bg-white/10 rounded px-2 py-1 opacity-0 group-hover:opacity-100 motion-safe:transition-opacity motion-safe:duration-200 motion-reduce:transition-none text-xs ${tap.overlayActive() ? '!opacity-100' : ''}`}>
                  <SvgEye class="sm-icon" />{image().exif?.Photo?.FocalLength}mm
                </span>
                <span class={`basis-[5rem] flex-grow flex items-center gap-1 whitespace-nowrap backdrop-blur-sm bg-white/10 rounded px-2 py-1 opacity-0 group-hover:opacity-100 motion-safe:transition-opacity motion-safe:duration-200 motion-reduce:transition-none text-xs ${tap.overlayActive() ? '!opacity-100' : ''}`}>
                  <SvgAperture class="sm-icon" />f/{image().exif?.Photo?.FNumber}
                </span>
              </div>
              <div class="flex basis-[11rem] flex-grow flex-wrap gap-0.5 flex-row">
                <span class={`basis-[5rem] flex-grow flex items-center gap-1 whitespace-nowrap backdrop-blur-sm bg-white/10 rounded px-2 py-1 opacity-0 group-hover:opacity-100 motion-safe:transition-opacity motion-safe:duration-200 motion-reduce:transition-none text-xs ${tap.overlayActive() ? '!opacity-100' : ''}`}>
                  <SvgStopwatch class="sm-icon" />{formatExposureTime(image().exif?.Photo?.ExposureTime)}
                </span>
                <span class={`basis-[5rem] flex-grow flex items-center gap-1 whitespace-nowrap backdrop-blur-sm bg-white/10 rounded px-2 py-1 opacity-0 group-hover:opacity-100 motion-safe:transition-opacity motion-safe:duration-200 motion-reduce:transition-none text-xs ${tap.overlayActive() ? '!opacity-100' : ''}`}>
                  {/* Improved ISO icon */}
                  <svg viewBox="0 0 24 24" class="sm-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="3" />
                    <text x="12" y="16" text-anchor="middle" font-size="8" font-family="monospace" fill="currentColor" stroke="none">ISO</text>
                  </svg>
                  {image().exif?.Photo?.ISOSpeedRatings}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 