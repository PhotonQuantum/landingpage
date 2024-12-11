import { query, RouteDefinition } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";

let cachedPages: [string, Record<string, any>][] | undefined = undefined;

export const getPages = query(async () => {
  "use server";
  if (cachedPages !== undefined) {
    return cachedPages;
  }
  return cachedPages = (await fetchPagesAux()) as any;
}, "links");

const fetchPagesAux = async () => {
  const events = getRequestEvent();
  if (!events) {
    console.warn("no events found");
    return []
  }
  const routes: RouteDefinition[] = (events as any).routes;
  if (!routes) {
    console.warn("no routes found");
    return []
  }
  const profile = routes.find(route => (route as any).id === "/(profile)")!;
  const subRoutes = profile.children;
  let pages = [];
  if (Array.isArray(subRoutes)) {
    for (const route_ of subRoutes) {
      const route = route_ as any;
      try {
        const {metadata} = await route.$component.import();
        if (metadata) {
          if (metadata.order !== undefined) {
            pages.push([route_.path!, metadata]);
          } else {
            console.warn("missing order in metadata, skipping", metadata);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
  } else if (subRoutes) {
    const route = subRoutes as any;
    try {
      const {metadata} = await route.$component.import();
      pages.push([subRoutes.path!, metadata]);
    } catch (e) {
      console.error(e);
    }
  }
  pages.sort((a, b) => a[1].order - b[1].order);
  return pages;
}
