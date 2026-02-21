export function adjustedSrcset(srcset: string, baseWidth: number): string {
  return srcset
    .split(",")
    .map((entry) => {
      const [url, descriptor] = entry.trim().split(" ");
      const width = parseInt(descriptor.replace("w", ""));
      const scale = width / baseWidth;
      return `${url} ${scale.toFixed(2)}x`;
    })
    .join(", ");
}
