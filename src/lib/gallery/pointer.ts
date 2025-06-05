import { GalleryGroup } from "~/data/galleryData";
import { ViewerImage, ImageWithBlurhash, ExifMetadata } from "~/data/galleryData";

export type ImagePointer = {
    groupIndex: number;
    itemIndex: number;
    imageIndex: number;
};

export const isPointerEqualOpt = (a?: ImagePointer, b?: ImagePointer) => {
    if (!a || !b) return false;
    return a.groupIndex === b.groupIndex && a.itemIndex === b.itemIndex && a.imageIndex === b.imageIndex;
};

export const isPointerEqual = (a: ImagePointer, b: ImagePointer) => {
    return a.groupIndex === b.groupIndex && a.itemIndex === b.itemIndex && a.imageIndex === b.imageIndex;
};

export const locatePointer = (galleryGroups: GalleryGroup[], galleryItemId: string, imageId: string): ImagePointer | undefined => {
    const groupIndex = galleryGroups.findIndex(group => group.items.some(item => item.id === galleryItemId));
    if (groupIndex === -1) return undefined;
    const itemIndex = galleryGroups[groupIndex].items.findIndex(item => item.images.some(([id, _]) => id === imageId));
    if (itemIndex === -1) return undefined;
    const imageIndex = galleryGroups[groupIndex].items[itemIndex].images.findIndex(([id, _]) => id === imageId);
    return { groupIndex, itemIndex, imageIndex };
};

export const nextPointer = (galleryGroups: GalleryGroup[], pointer: ImagePointer): ImagePointer | undefined => {
    let { groupIndex, itemIndex, imageIndex } = pointer;
    const group = galleryGroups[groupIndex];
    if (!group) return undefined;
    const item = group.items[itemIndex];
    if (!item) return undefined;
    // Try next image in current item
    if (imageIndex + 1 < item.images.length) {
        return { groupIndex, itemIndex, imageIndex: imageIndex + 1 };
    }
    // Try next item in current group
    if (itemIndex + 1 < group.items.length) {
        const nextItem = group.items[itemIndex + 1];
        if (nextItem.images.length > 0) {
            return { groupIndex, itemIndex: itemIndex + 1, imageIndex: 0 };
        }
    }
    // Try next group
    if (groupIndex + 1 < galleryGroups.length) {
        const nextGroup = galleryGroups[groupIndex + 1];
        if (nextGroup.items.length > 0 && nextGroup.items[0].images.length > 0) {
            return { groupIndex: groupIndex + 1, itemIndex: 0, imageIndex: 0 };
        }
    }
    // No next image
    return undefined;
};

export const prevPointer = (galleryGroups: GalleryGroup[], pointer: ImagePointer): ImagePointer | undefined => {
    let { groupIndex, itemIndex, imageIndex } = pointer;
    const group = galleryGroups[groupIndex];
    if (!group) return undefined;
    const item = group.items[itemIndex];
    if (!item) return undefined;
    // Try previous image in current item
    if (imageIndex > 0) {
        return { groupIndex, itemIndex, imageIndex: imageIndex - 1 };
    }
    // Try previous item in current group
    if (itemIndex > 0) {
        const prevItem = group.items[itemIndex - 1];
        if (prevItem.images.length > 0) {
            return { groupIndex, itemIndex: itemIndex - 1, imageIndex: prevItem.images.length - 1 };
        }
    }
    // Try previous group
    if (groupIndex > 0) {
        const prevGroup = galleryGroups[groupIndex - 1];
        if (prevGroup.items.length > 0) {
            const lastItemIdx = prevGroup.items.length - 1;
            const lastItem = prevGroup.items[lastItemIdx];
            if (lastItem.images.length > 0) {
                return { groupIndex: groupIndex - 1, itemIndex: lastItemIdx, imageIndex: lastItem.images.length - 1 };
            }
        }
    }
    // No previous image
    return undefined;
};

export interface reverseLookupPointerResult {
    galleryItemId: string;
    imageId: string;
    image: ViewerImage & ImageWithBlurhash & ExifMetadata;
}

export const reverseLookupPointer = (galleryGroups: GalleryGroup[], pointer: ImagePointer): reverseLookupPointerResult => {
    const group = galleryGroups[pointer.groupIndex];
    const item = group.items[pointer.itemIndex];
    const image = item.images[pointer.imageIndex];
    return {
        galleryItemId: item.id,
        imageId: image[0],
        image: image[1]
    };
};