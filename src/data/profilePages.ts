interface Metadata {
    name: string;
    order: number;
}

export interface Profile {
    path: string;
    name: string;
}

const profiles = import.meta.glob("~/routes/\\(profile\\)/*.mdx", { import: "metadata", eager: true });

export const profilePages: Profile[] = Object.entries(profiles).map(([path, metadata]) => {
    const relPath = path.split("/").pop()!;
    return {
        path: relPath,
        ...metadata as Metadata,
    }
}).sort((a, b) => a.order - b.order).map(d => {
    const { order, ...rest } = d;
    return rest;
});
