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
    let relPath = path.split("/").pop()!;
    // Remove file extension
    relPath = relPath.replace(/\.[^/.]+$/, "");
    // Handle index page
    relPath = relPath === "index" ? "/" : relPath;
    return {
        path: relPath,
        ...metadata as Metadata,
    }
}).sort((a, b) => a.order - b.order).map(d => {
    const { order, ...rest } = d;
    return rest;
});
