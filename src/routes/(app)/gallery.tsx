import { RouteSectionProps } from "@solidjs/router";
import { getGalleryGroups } from "~/apis/galleryData";
import { For } from "solid-js";
import { GalleryGroup } from "~/components/GalleryGroup";
import { createAsync } from "@solidjs/router";

export default function Gallery(props: RouteSectionProps) {
    const galleryGroups = createAsync(() => getGalleryGroups());
    return (
        <div class="flex flex-col gap-12">
            <For each={galleryGroups()}>{group =>
                <GalleryGroup group={group} />
            }</For>
        </div>
    );
}
