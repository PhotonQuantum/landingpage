export function sortImagesByFeatured<T extends { filename: string }>(images: T[], featuredSet: Set<string>) {
  if (!featuredSet || featuredSet.size === 0) return images;
  const featuredImages = images.filter(img => featuredSet.has(img.filename));
  const restImages = images.filter(img => !featuredSet.has(img.filename));
  return [...featuredImages, ...restImages];
}

export function adjustedSrcset(srcset: string, baseWidth: number): string {
  return srcset
    .split(',')
    .map(entry => {
      const [url, descriptor] = entry.trim().split(' ');
      const width = parseInt(descriptor.replace("w", ""));
      const scale = width / baseWidth;
      return `${url} ${scale.toFixed(2)}x`;
    })
    .join(', ');
}

export function adjustedSrcsetHardCoded(srcset: string): string {
  const scales = [1, 1.5, 2, 3];
  return srcset
    .split(',')
    .map((entry, i) => {
      const [url, _] = entry.trim().split(' ');
      return `${url} ${scales[i]}x`;
    })
    .join(', ');
}

export function identity<T>(x: T): T {
  return x;
}