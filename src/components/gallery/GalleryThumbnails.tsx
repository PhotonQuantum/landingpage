import { batch, createEffect, createMemo, createSignal, For, JSX, onMount, splitProps, untrack } from "solid-js";
import { GalleryGroup } from "~/data/galleryData";
import { ImagePointer, isPointerEqual, isPointerEqualOpt, nextPointer, prevPointer, reverseLookupPointer } from "~/lib/gallery/pointer";
import { VirtualizerHandle, Virtualizer } from "virtua/solid"


export interface GalleryThumbnailsProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "pointer" | "onSelect"> {
  galleryGroups: GalleryGroup[];
  pointer?: ImagePointer;
  onSelect: (pointer: ImagePointer) => void;
}

const BATCH_SIZE = 100;
const THRESHOLD = 50;
const MOUNTED_WINDOW = 50;

// Utility to get a batch of adjacent pointers
const batchGetPointers = (
  galleryGroups: GalleryGroup[],
  pointer: ImagePointer | undefined,
  includeSelf: boolean,
  prevCount: number,
  nextCount: number
) => {
  if (!galleryGroups || !pointer) return { pointers: [], prevFetchedCount: 0, nextFetchedCount: 0 }
  let pointers: ImagePointer[] = includeSelf ? [pointer] : [];
  // Walk backwards
  let prev = pointer;
  let prevFetchedCount = 0;
  for (let i = 0; i < prevCount; i++) {
    const prevP = prevPointer(galleryGroups, prev);
    if (!prevP) break;
    pointers.unshift(prevP);
    prev = prevP;
    prevFetchedCount++;
  }
  // Walk forwards
  let next = pointer;
  let nextFetchedCount = 0;
  for (let i = 0; i < nextCount; i++) {
    const nextP = nextPointer(galleryGroups, next);
    if (!nextP) break;
    pointers.push(nextP);
    next = nextP;
    nextFetchedCount++;
  }
  return {
    pointers,
    prevFetchedCount,
    nextFetchedCount
  };
}

export default function GalleryThumbnails(props: GalleryThumbnailsProps) {
  const [_, others] = splitProps(props, ["galleryGroups", "pointer", "onSelect"]);

  const [handler, setHandler] = createSignal<VirtualizerHandle>();
  const { pointers, prevFetchedCount } = batchGetPointers(props.galleryGroups, props.pointer, true, BATCH_SIZE / 2, BATCH_SIZE / 2)
  const [data, setData] = createSignal<ImagePointer[]>(pointers || []);
  const [selectedIdx, setSelectedIdx] = createSignal(prevFetchedCount);
  const [shift, setShift] = createSignal(false);

  createEffect(() => {
    const localHandler = handler();
    if (localHandler) {
      localHandler.scrollToIndex(selectedIdx(), { align: "center", smooth: true });
    }
  })

  // Sync selectedIdx with props.pointer
  createEffect(() => {
    const localPointer = props.pointer;
    const selectedPointer = untrack(data)[untrack(selectedIdx)];

    if (!localPointer) return;

    if (isPointerEqualOpt(localPointer, selectedPointer)) {
      return;
    }
    if (isPointerEqualOpt(prevPointer(props.galleryGroups, localPointer), selectedPointer)) {
      setSelectedIdx(prev => prev + 1);
    } else if (isPointerEqualOpt(nextPointer(props.galleryGroups, localPointer), selectedPointer)) {
      setSelectedIdx(prev => prev - 1);
    } else {
      // Completely lost sync, need to scan data set.
      setSelectedIdx(untrack(data).findIndex((p) => isPointerEqual(p, localPointer)));
    }
  });

  let startFetchedCount = -1;
  let endFetchedCount = -1;
  const count = createMemo(() => data().length);

  const scrollHandler = () => {
    const localCount = count();
    if (endFetchedCount < localCount && handler()!.findEndIndex() + THRESHOLD > localCount) {
      endFetchedCount = localCount;
      setShift(false);
      setData(prev => [
        ...prev,
        ...batchGetPointers(props.galleryGroups, prev[prev.length - 1], false, 0, BATCH_SIZE).pointers
      ]);
    } else if (startFetchedCount < localCount && handler()!.findStartIndex() - THRESHOLD < 0) {
      startFetchedCount = localCount;
      setShift(true);
      batch(() => {
        setData(prev => {
          const { pointers, prevFetchedCount } = batchGetPointers(props.galleryGroups, prev[0], false, BATCH_SIZE, 0);
          setSelectedIdx(prev => prev + prevFetchedCount);
          return [
            ...pointers,
            ...prev
          ]
        });
      })
    }
  };

  const keepMounted = () => {
    const localIndex = selectedIdx();
    const margin = MOUNTED_WINDOW / 4;
    const left = Math.max(0, localIndex - localIndex % margin - MOUNTED_WINDOW / 2);
    const right = Math.min(data().length - 1, localIndex + localIndex % margin + MOUNTED_WINDOW / 2);
    return Array.from({ length: right - left + 1 }, (_, i) => left + i);
  }

  return (
    <div {...others} class="h-20 w-full shrink-0 bg-black/70 backdrop-blur-3xl p-2 overflow-x-auto select-none" style={{ "overflow-anchor": "none", "scrollbar-width": "none" }}>
      <Virtualizer ref={(el) => { setHandler(el!); }}
        shift={shift()}
        onScroll={scrollHandler}
        data={data()}
        itemSize={64}
        keepMounted={keepMounted()}
        horizontal
      >
        {
          (thumbPointer: ImagePointer, idx) => {
            const { image } = reverseLookupPointer(props.galleryGroups, thumbPointer);
            return (
              <img
                src={image?.items?.[0]?.src || ""}
                class={`h-16 w-16 object-cover rounded-xl cursor-pointer border-2 !bg-clip-padding ${selectedIdx() === idx() ? 'border-accent' : 'border-transparent'}`}
                style={{
                  background: image?.blurhashGradient || "auto"
                }}
                onClick={() => {
                  setSelectedIdx(idx());
                  props.onSelect(thumbPointer)
                }
                }
                loading="lazy"
                decoding="async"
              />
            );
          }
        }
      </Virtualizer>
    </div>
  )
}