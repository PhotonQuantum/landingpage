import { For, JSX, splitProps } from "solid-js";
import { Picture } from "vite-imagetools";

export interface ImageProps extends Omit<JSX.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: Picture;
  baseSize?: number;
}

export default function Image(props: ImageProps) {
  const [local, rest] = splitProps(props, ['src', 'baseSize']);
  const baseSize = local.baseSize;
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