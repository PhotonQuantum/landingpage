import { useContext, createMemo, Component, For } from "solid-js";
import { GalleryGroupsContext } from "~/context/gallery";
import { GalleryGroup } from "~/data/galleryData";
import { ImagePointer, prevPointer, nextPointer } from "~/lib/gallery/pointer";

export interface GalleryPopupProps {
  pointer: ImagePointer | undefined;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onSelect: (pointer: ImagePointer) => void;
}

// Utility to get a window of adjacent pointers
function getAdjacentPointers(
  galleryGroups: GalleryGroup[],
  pointer: ImagePointer | undefined,
  windowSize: number = 2
): ImagePointer[] {
  if (!galleryGroups || !pointer) return [];
  let pointers: ImagePointer[] = [pointer];
  // Walk backwards
  let prev = pointer;
  for (let i = 0; i < windowSize; i++) {
    const prevP = prevPointer(galleryGroups, prev);
    if (!prevP) break;
    pointers.unshift(prevP);
    prev = prevP;
  }
  // Walk forwards
  let next = pointer;
  for (let i = 0; i < windowSize; i++) {
    const nextP = nextPointer(galleryGroups, next);
    if (!nextP) break;
    pointers.push(nextP);
    next = nextP;
  }
  return pointers;
}

export const GalleryPopup: Component<GalleryPopupProps> = (props) => {
  const galleryGroups = useContext(GalleryGroupsContext)!;

  const currentImage = createMemo(() => {
    const p = props.pointer;
    if (!galleryGroups || !p) return undefined;
    return galleryGroups[p.groupIndex].items[p.itemIndex].images[p.imageIndex][1];
  });
  const currentInfo = createMemo(() => currentImage() || {});

  // Use the extracted utility for thumbnail pointers
  const thumbnailPointers = createMemo(() => getAdjacentPointers(galleryGroups, props.pointer, 2));

  return (
    <div class="fixed inset-0 z-100 flex flex-row bg-black/80">
      {/* Left navigation */}
      <button class="w-12 flex items-center justify-center text-white/70 hover:text-white transition" onClick={props.onPrev}>
        <span class="text-3xl">&#8592;</span>
      </button>

      {/* Main image area */}
      <div class="flex-1 flex flex-col justify-center items-center relative">
        <img src={currentImage()?.items?.[0]?.src || ""} alt="main" class="max-h-[70vh] max-w-full rounded shadow-lg object-contain bg-black" />
        {/* Bottom thumbnail strip */}
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-row gap-2 bg-black/60 rounded p-2">
          <For each={thumbnailPointers()}>{(thumbPointer) => {
            const img = galleryGroups && thumbPointer
              ? galleryGroups[thumbPointer.groupIndex].items[thumbPointer.itemIndex].images[thumbPointer.imageIndex][1]
              : undefined;
            return (
              <img
                src={img?.items?.[0]?.src || ""}
                alt={`thumb`}
                class={`h-16 w-16 object-cover rounded cursor-pointer border-2 ${JSON.stringify(thumbPointer) === JSON.stringify(props.pointer) ? 'border-accent' : 'border-transparent'}`}
                onClick={() => props.onSelect(thumbPointer)}
              />
            );
          }}</For>
        </div>
      </div>

      {/* Right info panel */}
      <div class="w-[340px] bg-gradient-to-l from-black/80 to-black/30 text-white p-6 overflow-y-auto flex flex-col">
        <button class="self-end mb-2 text-white/70 hover:text-white" onClick={props.onClose}>
          <span class="text-2xl">&#10005;</span>
        </button>
        <h2 class="text-lg font-bold mb-4">Image Info</h2>
        <div class="text-sm space-y-2">
          <For each={Object.entries(currentInfo())}>{([key, value]) =>
            <div class="flex justify-between border-b border-white/10 py-1">
              <span class="text-gray-300">{key}</span>
              <span class="text-right break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
            </div>
          }</For>
        </div>
      </div>

      {/* Right navigation */}
      <button class="w-12 flex items-center justify-center text-white/70 hover:text-white transition" onClick={props.onNext}>
        <span class="text-3xl">&#8594;</span>
      </button>
    </div>
  );
};
