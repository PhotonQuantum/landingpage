import { Exif } from "exif-reader";
import { Picture } from "vite-imagetools";
import imagesJson from "~/assets/gallery/images.json";
import thumbnailsJson from "~/assets/gallery/thumbnails.json";
import blurhashJson from "~/assets/gallery/blurhash.json";
import exifJson from "~/assets/gallery/exif.json";

export interface GalleryMeta {
  year: number;
  month: number;
  day: number;
  location: string;
  topic: string;
  featured?: string[];
  offset?: string;
  doubleRow?: string[];
  overrideOrder?: string[][];
}

interface BlurhashMetadata {
  blurhash: string;
  blurhashGradient: string;
  blurhashXComponents: number;
  blurhashYComponents: number;
}

export interface ExifMetadata {
  exif: Exif;
}

interface BaseImageMetadata {
  filename: string;
}

export interface ImageWithBlurhash extends BaseImageMetadata {
  blurhash?: string;
  blurhashGradient?: string;
  blurhashXComponents?: number;
  blurhashYComponents?: number;
}

export interface GalleryItem {
  id: string;
  meta: GalleryMeta;
  images: [string, Picture & ImageWithBlurhash & ExifMetadata][];
  thumbnails: [string, Picture & ImageWithBlurhash & ExifMetadata][];
}

export type GalleryGroup = {
  location: string;
  date: Date;
  items: GalleryItem[];
};


// @ts-ignore
const galleryMeta: Record<string, GalleryMeta> = import.meta.glob("~/assets/gallery/**/meta.json", { eager: true })

const galleryImages = imagesJson as unknown as Record<string, Picture & BaseImageMetadata>;
const galleryThumbnails = thumbnailsJson as unknown as Record<string, Picture & BaseImageMetadata>;
const galleryBlurhash = blurhashJson as unknown as Record<string, { blurhash: BlurhashMetadata }>;
const galleryExif = exifJson as unknown as Record<string, ExifMetadata>;

// Organize gallery items
const galleryItems: GalleryItem[] = Object.entries(galleryMeta).map(([path, meta]) => {
  const id = path.split('/').slice(-2)[0]; // Get the folder name as ID

  let imagesArr = Object.entries(galleryImages)
    .filter(([imgPath]) => imgPath.includes(id))
    .map(([path, picture]) => {
      const filename = path.split('/').pop()?.replace('.jpg', '') || '';
      const blurhashData = galleryBlurhash[path].blurhash;
      const exifData = galleryExif[path];
      // Patch OffsetTimeOriginal if missing but present in meta
      if (exifData && exifData.exif && meta.offset) {
        if (!exifData.exif.Photo) exifData.exif.Photo = {};
        if (!exifData.exif.Photo.OffsetTimeOriginal) {
          exifData.exif.Photo.OffsetTimeOriginal = meta.offset;
        }
      }
      return [filename, {
        ...picture,
        filename: id + '/' + filename,
        ...(blurhashData && {
          blurhash: blurhashData.blurhash,
          blurhashGradient: blurhashData.blurhashGradient,
          blurhashXComponents: blurhashData.blurhashXComponents,
          blurhashYComponents: blurhashData.blurhashYComponents,
        }),
        ...(exifData && {
          exif: exifData.exif,
        })
      }] as [string, Picture & ImageWithBlurhash & ExifMetadata];
    }).sort(([, a], [, b]) => a.filename.localeCompare(b.filename));

  if (meta.overrideOrder) {
    for (const [fst, snd] of meta.overrideOrder) {
      const fst_ = fst.replace('.jpg', '');
      const snd_ = snd.replace('.jpg', '');
      const fstIdx = imagesArr.findIndex(([k]) => k === fst_);
      const sndIdx = imagesArr.findIndex(([k]) => k === snd_);
      if (fstIdx !== -1 && sndIdx !== -1 && fstIdx !== sndIdx - 1) {
        // Remove fst from its current position
        const [fstItem] = imagesArr.splice(fstIdx, 1);
        // Insert fst just before snd
        const insertIdx = sndIdx > fstIdx ? sndIdx - 1 : sndIdx;
        imagesArr.splice(insertIdx, 0, fstItem);
      }
    }
  }

  let thumbnailsArr = Object.entries(galleryThumbnails)
    .filter(([imgPath]) => imgPath.includes(id))
    .map(([path, picture]) => {
      const filename = path.split('/').pop()?.replace('.jpg', '') || '';
      const blurhashData = galleryBlurhash[path].blurhash;
      const exifData = galleryExif[path];
      // Patch OffsetTimeOriginal if missing but present in meta
      if (exifData && exifData.exif && meta.offset) {
        if (!exifData.exif.Photo) exifData.exif.Photo = {};
        if (!exifData.exif.Photo.OffsetTimeOriginal) {
          exifData.exif.Photo.OffsetTimeOriginal = meta.offset;
        }
      }
      return [filename, {
        ...picture,
        filename: id + '/' + filename,
        ...(blurhashData && {
          blurhash: blurhashData.blurhash,
          blurhashGradient: blurhashData.blurhashGradient,
          blurhashXComponents: blurhashData.blurhashXComponents,
          blurhashYComponents: blurhashData.blurhashYComponents,
        }),
        ...(exifData && {
          exif: exifData.exif,
        })
      }] as [string, Picture & ImageWithBlurhash & ExifMetadata];
    }).sort(([, a], [, b]) => a.filename.localeCompare(b.filename));

  if (meta.overrideOrder) {
    for (const [fst, snd] of meta.overrideOrder) {
      const fst_ = fst.replace('.jpg', '');
      const snd_ = snd.replace('.jpg', '');
      const fstIdx = thumbnailsArr.findIndex(([k]) => k === fst_);
      const sndIdx = thumbnailsArr.findIndex(([k]) => k === snd_);
      if (fstIdx !== -1 && sndIdx !== -1 && fstIdx !== sndIdx - 1) {
        // Remove fst from its current position
        const [fstItem] = thumbnailsArr.splice(fstIdx, 1);
        // Insert fst just before snd
        const insertIdx = sndIdx > fstIdx ? sndIdx - 1 : sndIdx;
        thumbnailsArr.splice(insertIdx, 0, fstItem);
      }
    }
  }

  return {
    id,
    meta,
    images: imagesArr,
    thumbnails: thumbnailsArr
  };
}).sort((a, b) => {
  const dateA = new Date(a.meta.year, a.meta.month - 1, a.meta.day);
  const dateB = new Date(b.meta.year, b.meta.month - 1, b.meta.day);
  return dateA.getTime() - dateB.getTime();
});

export function getGalleryGroups(): GalleryGroup[] {
  // Group by location + month + year
  const groupsMap = new Map<string, GalleryGroup>();
  for (const item of galleryItems) {
    const { location, month, year } = item.meta;
    const date = new Date(year, month - 1);
    // NOTE const label = `${location} \u00B7 ${getMonthName(month)} ${year}`;
    const key = `${location}-${year}-${month}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, { location, date, items: [] });
    }
    groupsMap.get(key)!.items.push(item);
  }
  // Sort groups by date (newest first)
  return Array.from(groupsMap.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
} 