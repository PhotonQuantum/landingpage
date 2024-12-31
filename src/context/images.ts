import { Context, createContext } from "solid-js";
import { SetStoreFunction, Store } from "solid-js/store";
import { ImageMeta } from "~/components/Image";

export type ImageMap = [string, ImageMeta][];

export const ImagesContext: Context<[get: Store<ImageMap>, set: SetStoreFunction<ImageMap>] | undefined> = createContext();