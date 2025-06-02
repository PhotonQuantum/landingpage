import { Component, createEffect, splitProps } from "solid-js";
import SvgChevronDown from "@tabler/icons/outline/chevron-down.svg";
import SvgChevronUp from "@tabler/icons/outline/chevron-up.svg";
import { Accessor } from "solid-js";

interface GalleryHeaderProps {
    label: string;
    isExpanded: Accessor<boolean>;
    canExpand: Accessor<boolean>;
    onExpand: () => void;
    onCollapse: () => void;
    isSticky: Accessor<boolean>;
    onHeaderClick: () => void;
}

export const GalleryHeader: Component<GalleryHeaderProps> = (props) => {
    const [local, _] = splitProps(props, [
        "label",
        "isExpanded",
        "canExpand",
        "onExpand",
        "onCollapse",
        "isSticky",
        "onHeaderClick"
    ]);

    return (
        <div
            class={`sticky top-16 z-30 flex items-center justify-between px-2 py-1 motion-safe:transition-all motion-safe:duration-200 ${local.isSticky() ? 'bg-background-60 backdrop-blur-sm' : ''
                }`}
        >
            <div class="flex items-center gap-3">
                <h2
                    class="text-lg font-medium text-label cursor-pointer hover:text-ctp-text motion-safe:transition-colors"
                    onClick={local.onHeaderClick}
                >
                    {local.label}
                </h2>
                {(local.canExpand() || local.isExpanded()) && (
                    <button
                        class="flex items-center gap-1 text-xs font-semibold cursor-pointer px-3 py-1 rounded-full bg-ctp-mantle/60 border border-ctp-subtext0/10 text-ctp-subtext0 hover:bg-ctp-mantle/80 hover:text-ctp-text motion-safe:transition-colors"
                        onClick={local.isExpanded() ? local.onCollapse : local.onExpand}
                    >
                        {local.isExpanded() ? "Collapse" : "Expand"}
                        {local.isExpanded() ? (
                            <SvgChevronUp class="w-4 h-4" />
                        ) : (
                            <SvgChevronDown class="w-4 h-4" />
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}; 