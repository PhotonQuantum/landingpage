import { createContext, Context } from "solid-js";
import type { GalleryGroup as GalleryGroupType } from "~/data/galleryData";

export const GalleryGroupsContext: Context<GalleryGroupType[] | undefined> = createContext<GalleryGroupType[]>(); 