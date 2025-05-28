import { query } from "@solidjs/router";
import { Exif } from "exif-reader";
import { Picture } from "vite-imagetools";

export interface GalleryMeta {
  year: number;
  month: number;
  day: number;
  location: string;
  topic: string;
  featured?: string[];
  offset?: string;
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
  images: Record<string, Picture & ImageWithBlurhash & ExifMetadata>;
  thumbnails: Record<string, Picture & ImageWithBlurhash & ExifMetadata>;
}

export type GalleryGroup = {
  label: string; // e.g., "Montreal · April 2024"
  date: Date;
  items: GalleryItem[];
};

// Helper to get month name
function getMonthName(month: number) {
  return new Date(0, month - 1).toLocaleString("default", { month: "long" });
}

// @ts-ignore
const galleryMeta: Record<string, GalleryMeta> = import.meta.glob("~/assets/gallery/**/meta.json", { eager: true })

// @ts-ignore
export const galleryImages: Record<string, Picture & BaseImageMetadata> = import.meta.glob("~/assets/gallery/**/*.jpg", {
  query: "?w=1024;&withoutEnlargement&format=webp;jpeg&as=picture",
  eager: true
})

// @ts-ignore
export const galleryThumbnails: Record<string, Picture & BaseImageMetadata> = import.meta.glob(
  "~/assets/gallery/**/*.jpg",
  { query: "?h=275;412.5;550;825&withoutEnlargement&format=webp;jpeg&as=picture", eager: true }
)

// @ts-ignore
const galleryBlurhash: Record<string, BlurhashMetadata> = import.meta.glob(
  "~/assets/gallery/**/*.jpg",
  { query: "?w=128&format=&blurhash&as=meta:blurhash;blurhashGradient;blurhashXComponents;blurhashYComponents", eager: true }
)

// @ts-ignore
const galleryExif: Record<string, ExifMetadata> = import.meta.glob(
  "~/assets/gallery/**/*.jpg",
  { query: "?format=&exif&as=meta:exif", eager: true }
)

// Organize gallery items
const galleryItems: GalleryItem[] = Object.entries(galleryMeta).map(([path, meta]) => {
  const id = path.split('/').slice(-2)[0]; // Get the folder name as ID
  
  const images = Object.entries(galleryImages)
    .filter(([imgPath]) => imgPath.includes(id))
    .reduce((acc, [path, picture]) => {
      const filename = path.split('/').pop()?.replace('.jpg', '') || '';
      const blurhashData = galleryBlurhash[path];
      const exifData = galleryExif[path];
      // Patch OffsetTimeOriginal if missing but present in meta
      if (exifData && exifData.exif && meta.offset) {
        if (!exifData.exif.Photo) exifData.exif.Photo = {};
        if (!exifData.exif.Photo.OffsetTimeOriginal) {
          exifData.exif.Photo.OffsetTimeOriginal = meta.offset;
        }
      }
      acc[filename] = { 
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
      };
      return acc;
    }, {} as Record<string, Picture & ImageWithBlurhash & ExifMetadata>);

  const thumbnails = Object.entries(galleryThumbnails)
    .filter(([imgPath]) => imgPath.includes(id))
    .reduce((acc, [path, picture]) => {
      const filename = path.split('/').pop()?.replace('.jpg', '') || '';
      const blurhashData = galleryBlurhash[path];
      const exifData = galleryExif[path];
      // Patch OffsetTimeOriginal if missing but present in meta
      if (exifData && exifData.exif && meta.offset) {
        if (!exifData.exif.Photo) exifData.exif.Photo = {};
        if (!exifData.exif.Photo.OffsetTimeOriginal) {
          exifData.exif.Photo.OffsetTimeOriginal = meta.offset;
        }
      }
      acc[filename] = { 
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
      };
      return acc;
    }, {} as Record<string, Picture & ImageWithBlurhash & ExifMetadata>);

  return {
    id,
    meta,
    images,
    thumbnails
  };
}).sort((a, b) => {
  const dateA = new Date(a.meta.year, a.meta.month - 1, a.meta.day);
  const dateB = new Date(b.meta.year, b.meta.month - 1, b.meta.day);
  return dateA.getTime() - dateB.getTime();
});

let cached: GalleryGroup[] | undefined = undefined;

export const getGalleryGroups = query(async () => {
  "use server";
  if (cached !== undefined) {
    return cached;
  }
  return cached = (await getGalleryGroupsAux()) as any;
}, "gallery-groups");

function getGalleryGroupsAux(): GalleryGroup[] {
  // Group by location + month + year
  const groupsMap = new Map<string, GalleryGroup>();
  for (const item of galleryItems) {
    const { location, month, year } = item.meta;
    const date = new Date(year, month - 1);
    const label = `${location} \u00B7 ${getMonthName(month)} ${year}`;
    const key = `${location}-${year}-${month}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, { label, date, items: [] });
    }
    groupsMap.get(key)!.items.push(item);
  }
  // Sort groups by date (newest first)
  return Array.from(groupsMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
} 