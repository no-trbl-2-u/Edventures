/**
 * Per-page Open Graph images (Roadmap 2.6.4).
 *
 * `og-default.png` (the lockup on cream, built by brand-assets.mjs) covers
 * every page that doesn't have a more specific image. Two pages do: the home
 * page has the hero photo, and the gallery page is, by definition, photos.
 * Reusing those instead of the generic lockup gives the link preview an
 * actual dog or cat instead of a logo.
 *
 * Source photos already went through scripts/photos.mjs (EXIF-rotated,
 * GPS-stripped), so this script only has to crop to the 1200x630 OG ratio.
 * `position: "attention"` biases the crop toward the busiest region of the
 * frame rather than a bare centre crop, which matters here because several
 * candidates are portrait-orientation photos of a person and an animal
 * side by side.
 *
 * Run: npm run og (after `npm run photos`, since it reads src/assets/photos/)
 */
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const WIDTH = 1200;
const HEIGHT = 630;
const QUALITY = 82;

const TARGETS = [
  { placement: "hero", out: "public/og-home.jpg" },
  { placement: "gallery", out: "public/og-gallery.jpg" },
];

async function main() {
  const photos = JSON.parse(await readFile("src/content/photos.json", "utf8"));

  for (const { placement, out } of TARGETS) {
    const photo = photos.find((p) => p.placement === placement);
    if (!photo) throw new Error(`No photo with placement "${placement}" for ${out}`);

    const info = await sharp(`src/assets/photos/${photo.id}.jpg`)
      .resize({ width: WIDTH, height: HEIGHT, fit: "cover", position: "attention" })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toFile(out);

    console.log(`${out.padEnd(20)} from ${photo.id.padEnd(24)} ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
