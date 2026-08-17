/**
 * Pairs each processed image with its verified caption and alt text.
 *
 * The alt text in photos.json was written by looking at every photo, not by
 * reading the filename. That distinction is not pedantic: `Proud Cat Dad.jpeg`
 * contains no cat -- it is Edward alone on a Philadelphia street in a hat
 * embroidered "CAT DAD". Filename-derived alt text would have told a screen
 * reader user to expect an animal that isn't there.
 *
 * Going through this helper means an image can never be rendered without its
 * checked alt text: there is no path that supplies one but not the other.
 */
import type { ImageMetadata } from "astro";

const files = import.meta.glob<{ default: ImageMetadata }>(
  "../assets/photos/*.jpg",
  { eager: true },
);

/** slug -> imported image */
export const IMAGES: Record<string, ImageMetadata> = Object.fromEntries(
  Object.entries(files).map(([path, mod]) => [
    path.split("/").pop()!.replace(/\.jpg$/, ""),
    mod.default,
  ]),
);

export interface PhotoData {
  id: string;
  caption: string;
  alt: string;
  placement: "hero" | "about" | "gallery" | "excluded";
}

export interface ResolvedPhoto extends PhotoData {
  image: ImageMetadata;
}

/**
 * Resolve a photo by id, failing the build if the image is missing.
 *
 * A silent fallback here would ship a page with a hole in it; a thrown error
 * during `astro build` is noticed immediately.
 */
export function resolvePhoto(photo: PhotoData): ResolvedPhoto {
  const image = IMAGES[photo.id];
  if (!image) {
    throw new Error(
      `No processed image for photo "${photo.id}". Run \`npm run photos\` to rebuild src/assets/photos/.`,
    );
  }
  return { ...photo, image };
}

export function resolveAll(photos: PhotoData[]): ResolvedPhoto[] {
  return photos.map(resolvePhoto);
}

/** Photos for a given placement, excluding anything marked `excluded`. */
export function byPlacement(photos: PhotoData[], placement: PhotoData["placement"]) {
  return resolveAll(photos.filter((p) => p.placement === placement));
}
