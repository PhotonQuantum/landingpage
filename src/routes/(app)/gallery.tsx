import { RouteSectionProps } from "@solidjs/router";
import { getGalleryGroups } from "~/data/galleryData";
import { For } from "solid-js";
import { GalleryGroup } from "~/components/GalleryGroup";

export default function Gallery(props: RouteSectionProps) {
    const galleryGroups = getGalleryGroups();
    return (
        <div class="flex flex-col gap-12">
            <For each={galleryGroups}>{group =>
                <GalleryGroup group={group} />
            }</For>
        </div>
    );
}
