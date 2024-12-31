import { createUniqueId, FlowProps, For, JSX, onCleanup, onMount, splitProps, useContext } from "solid-js";
import { Picture } from "vite-imagetools";
import { createStore } from "solid-js/store";
import { ImageMap, ImagesContext } from "~/context/images";

export interface ImageMeta {
  src: Picture;
  baseSize?: number;
  order?: number;
  description?: string;
}

export interface ImageProps extends Omit<JSX.ImgHTMLAttributes<HTMLImageElement>, 'src'>, ImageMeta {
}

export const ImagesProvider = (props: FlowProps) => {
  const store = createStore<ImageMap>([]);
  return (
    <ImagesContext.Provider value={store}>
      {props.children}
    </ImagesContext.Provider>
  )
}

export const useImages = () => {
  const maybeImages = useContext(ImagesContext);
  if (maybeImages === undefined) {
    return [undefined, [() => {
    }, () => {
    }]] as const;
  }

  const [images, setImages] = maybeImages;
  const removeImage = (id: string) => {
    setImages(images.filter(([key]) => key !== id));
  }
  const addImage = (id: string, image: ImageMeta) => {
    const order = image.order;
    setImages((elems) => {
      for (let i = 0; i < elems.length; i++) {
        const [id_, {order: order_}] = elems[i];
        console.log("comparing id", id, id_, "order", order, order_);
        if (order_ === undefined) {
          if (order === undefined) {
            if (id_ >= id) {
              return elems.toSpliced(i, (id_ === id) ? 1 : 0, [id, image]);
            }
          } else {
            return elems.toSpliced(i, 0, [id, image]);
          }
        } else {
          if (order !== undefined) {
            if (order_ > order) {
              console.log("inserting", id, "before", id_);
              return elems.toSpliced(i, 0, [id, image]);
            } else if (order_ === order) {
              if (id_ >= id) {
                return elems.toSpliced(i, (id_ === id) ? 1 : 0, [id, image]);
              }
            }
          }
        }
      }
      return elems.toSpliced(elems.length, 0, [id, image]);
    })
  }

  return [images, [addImage, removeImage]] as const;
}

export const Image = (props: ImageProps) => {
  const [local, rest] = splitProps(props, ['src', 'order', 'baseSize', 'description']);
  const baseSize = local.baseSize;

  const [_, [addImage, removeImage]] = useImages();
  const id = createUniqueId();
  onMount(() => {
    addImage(id, local);
  })
  onCleanup(() => {
    removeImage(id);
  })

  return (
    <picture class="not-prose">
      <For each={Object.entries(local.src.sources)}>{([format, srcset]) => {
        if (baseSize) {
          const adjustedSrcset = srcset
            .split(',')
            .map(entry => {
              const [url, descriptor] = entry.trim().split(' ');
              const width = parseInt(descriptor.replace("w", ""));
              const scale = width / baseSize;
              return `${url} ${scale.toFixed(2)}x`;
            })
            .join(', ');
          return (
            <source srcset={adjustedSrcset} type={`image/${format}`} />
          );
        } else {
          return (<source srcset={srcset} type={`image/${format}`} />)
        }
      }}</For>
      <img src={local.src.img.src} {...rest} />
    </picture>
  )
}

