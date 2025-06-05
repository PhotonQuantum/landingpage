import { RouteSectionProps, useNavigate } from "@solidjs/router";
import { getGalleryGroups } from "~/data/galleryData";
import { For, Suspense } from "solid-js";
import { GalleryGroup } from "~/components/GalleryGroup";
import { GalleryGroupsContext } from "~/context/gallery";

export default function Gallery(props: RouteSectionProps) {
    const galleryGroups = getGalleryGroups();
    const navigate = useNavigate();

    return (
        <GalleryGroupsContext.Provider value={galleryGroups}>
            <Suspense>
                {props.children}
            </Suspense>
            <div class="flex flex-col">
                <For each={galleryGroups}>{group =>
                    <GalleryGroup group={group} onNavigate={(filename) => {
                        navigate(`${filename}`, { scroll: false, state: { fromGallery: true } });
                    }} />
                }</For>
            </div>
        </GalleryGroupsContext.Provider>
    );
}
