/**
 * Phase 0.5 photo pipeline: starting-assets/ -> src/assets/photos/
 *
 * Normalises the 21 phone-camera originals into web-safe, slug-named sources.
 * Astro's own image pipeline handles responsive widths and WebP from there, so
 * this script only has to produce one clean, correctly-oriented JPEG per photo.
 *
 * Two things here are load-bearing:
 *
 * 1. `.rotate()` with no argument applies the EXIF orientation tag and then
 *    drops it. Nine of these photos carry tag 274. Browsers honour it, so they
 *    look fine today -- but a resize that reads raw pixels and discards EXIF
 *    bakes in the WRONG rotation. The bug appears during optimisation, not
 *    before it, which is exactly why it slips through review.
 *
 * 2. sharp strips all metadata unless told otherwise. That is deliberate here:
 *    several of these were taken inside clients' homes and carry GPS
 *    coordinates. Publishing those would leak customer addresses.
 *
 * Run: npm run photos
 */
import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";

const SRC = "starting-assets";
const OUT = "src/assets/photos";
const MAX_WIDTH = 1600;
const QUALITY = 82;

/**
 * slug -> original filename. The originals encode their captions in the
 * filename, which renaming would destroy; the captions already live in
 * src/content/photos.json, and this map preserves the provenance link back to
 * the archival file.
 */
const SOURCES = {
  "smooches": "Smooches.JPG",
  "stellaluna-at-the-park": "Stellaluna at the Park.JPG",
  "zoe-and-i": "Zoe and I.jpg",
  "jackie-and-i": "Jackie and I.jpg",
  "my-son-harry-and-i": "My son Harry and I.jpg",
  "harry-and-i": "Harry and I.jpg",
  "proud-cat-dad": "Proud Cat Dad.jpeg",
  "cuddling-with-auggy": "Cuddling with Auggy.jpg",
  "hubert": "My godchild Hubert.jpeg",
  "me-and-regina": "Me & Regina.jpeg",
  "me-and-taco": "Me & Taco.jpeg",
  "playing-with-xenon": "Playing with Xenon.jpg",
  "kisses-from-tecate": "Kisses from Tecate.jpeg",
  "selfie-with-tecate": "Selfie with Tecate.jpeg",
  "me-and-stellaluna": "ME and Stellaluna.JPG",
  "stellaluna-and-i": "Stellaluna and I.jpeg",
  "angel-and-i": "Angel and I, RIP.jpg",
  "a-fun-day-with-cows": "A fun day with Cows.jpeg",
  "me-and-goy-pouting": "Me and Goy Pouting.jpeg",
  "me-and-clancy": "ME and Clancy.jpeg",
  "kisses-from-jackie": "Kisses from Jackie.jpeg",
};

/**
 * True if the EXIF blob contains a GPS IFD pointer (tag 0x8825).
 *
 * Note this has to actually parse the TIFF header -- searching the buffer for
 * the string "GPS" finds nothing, because EXIF stores numeric tag IDs, not
 * names. That naive check reports a clean bill of health for every file, which
 * is the worst possible failure mode for a privacy check.
 */
function hasGpsTag(exif) {
  if (!exif || exif.length < 8) return false;
  const base = exif.subarray(0, 6).toString("ascii") === "Exif\0\0" ? 6 : 0;
  const littleEndian = exif.subarray(base, base + 2).toString("ascii") === "II";
  const u16 = (p) => (littleEndian ? exif.readUInt16LE(p) : exif.readUInt16BE(p));
  const u32 = (p) => (littleEndian ? exif.readUInt32LE(p) : exif.readUInt32BE(p));

  try {
    const ifd0 = base + u32(base + 4);
    const entries = u16(ifd0);
    for (let i = 0; i < entries; i++) {
      if (u16(ifd0 + 2 + i * 12) === 0x8825) return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const photos = JSON.parse(await readFile("src/content/photos.json", "utf8"));

  const missing = photos.filter((p) => !SOURCES[p.id]);
  if (missing.length) {
    throw new Error(`No source file mapped for: ${missing.map((p) => p.id).join(", ")}`);
  }

  let rotated = 0;
  let strippedGps = 0;

  for (const photo of photos) {
    const from = `${SRC}/${SOURCES[photo.id]}`;
    const to = `${OUT}/${photo.id}.jpg`;

    const meta = await sharp(from).metadata();
    const hadOrientation = (meta.orientation ?? 1) !== 1;
    const hadGps = hasGpsTag(meta.exif);

    // .rotate() before .resize() -- order matters. Rotating after the resize
    // would resize the wrong axis on the nine portrait photos.
    const info = await sharp(from)
      .rotate()
      .resize({ width: MAX_WIDTH, height: MAX_WIDTH, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toFile(to);

    if (hadOrientation) rotated++;
    if (hadGps) strippedGps++;

    // Cross-check the recorded flag against what the file actually carries, so
    // photos.json can't quietly drift from reality.
    if (hadOrientation !== photo.needsExifRotation) {
      console.warn(
        `  ! ${photo.id}: photos.json says needsExifRotation=${photo.needsExifRotation}, ` +
        `file says ${hadOrientation} (EXIF orientation ${meta.orientation ?? 1})`
      );
    }

    console.log(
      `${photo.id.padEnd(24)} ${String(info.width).padStart(4)}x${String(info.height).padEnd(4)} ` +
      `${(info.size / 1024).toFixed(0).padStart(4)}KB` +
      `${hadOrientation ? "  [rotation applied]" : ""}`
    );
  }

  console.log(
    `\n${photos.length} photos. EXIF rotation applied to ${rotated}. ` +
    `All metadata stripped -- ${strippedGps} originals carried GPS coordinates.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
