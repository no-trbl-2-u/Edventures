/**
 * Derive the brand asset set from starting-assets/LOGO.png.
 *
 * LOGO.png is dark artwork flattened onto an opaque white card. Every asset the
 * site needs is a crop of it with the white knocked out:
 *
 *   lockup.png             full stacked logo, transparent
 *   lockup-light.png       same silhouette painted cream, for the green footer
 *   mark.png               the E + dog + cat, no wordmark
 *   mark-initial.png       same as mark (kept as a distinct name so the header
 *                          and hero can diverge later without touching markup)
 *   mark-initial-light.png cream version for dark backgrounds
 *   paw.png                the paw print used as a divider glyph
 *
 * Run: npm run brand
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "starting-assets/LOGO.png";
const OUT = "src/assets/brand";
const CREAM = { r: 246, g: 237, b: 229 };

// White knocks out to transparent. The ramp is deliberately narrow and close to
// white so solid ink stays fully opaque and only the antialiased fringe feathers
// -- a wide ramp would make the green look washed out over a cream background.
const ALPHA_CLEAR = 246; // luminance at or above this is fully transparent
const ALPHA_SOLID = 224; // luminance at or below this is fully opaque

/** Replace the white card with an alpha channel, optionally repainting the ink. */
async function knockOutWhite(input, { paint = null } = {}) {
  const img = sharp(input).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);

  for (let i = 0, o = 0; i < data.length; i += channels, o += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    let a;
    if (lum >= ALPHA_CLEAR) a = 0;
    else if (lum <= ALPHA_SOLID) a = 255;
    else a = Math.round(((ALPHA_CLEAR - lum) / (ALPHA_CLEAR - ALPHA_SOLID)) * 255);

    if (paint) {
      out[o] = paint.r; out[o + 1] = paint.g; out[o + 2] = paint.b;
    } else {
      out[o] = r; out[o + 1] = g; out[o + 2] = b;
    }
    out[o + 3] = a;
  }

  return sharp(out, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 });
}

/** Trim fully-transparent margins so the asset sits flush in a flex row. */
const trimAlpha = (pipeline) => pipeline.trim({ threshold: 1 });

async function main() {
  await mkdir(OUT, { recursive: true });

  const { width, height } = await sharp(SRC).metadata();

  // The wordmark block ("EDVENTURES / PET SITTING / paw") occupies the bottom
  // ~38% of the card. Everything above it is the E-with-animals mark.
  const markHeight = Math.round(height * 0.635);
  const pawTop = Math.round(height * 0.80);

  const jobs = [
    // Full stacked lockup.
    ["lockup.png", () => sharp(SRC), null],
    ["lockup-light.png", () => sharp(SRC), CREAM],

    // Mark only: crop away the wordmark.
    ["mark.png", () => sharp(SRC).extract({ left: 0, top: 0, width, height: markHeight }), null],
    ["mark-initial.png", () => sharp(SRC).extract({ left: 0, top: 0, width, height: markHeight }), null],
    ["mark-initial-light.png", () => sharp(SRC).extract({ left: 0, top: 0, width, height: markHeight }), CREAM],

    // Paw glyph: bottom strip, centre third.
    ["paw.png", () => sharp(SRC).extract({
      left: Math.round(width * 0.468), top: pawTop,
      width: Math.round(width * 0.042), height: height - pawTop,
    }), null],
    ["paw-light.png", () => sharp(SRC).extract({
      left: Math.round(width * 0.468), top: pawTop,
      width: Math.round(width * 0.042), height: height - pawTop,
    }), CREAM],
  ];

  for (const [name, make, paint] of jobs) {
    const buf = await make().png().toBuffer();
    const knocked = await knockOutWhite(buf, { paint });
    const info = await trimAlpha(knocked).toFile(`${OUT}/${name}`);
    console.log(`${name.padEnd(24)} ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)}KB`);
  }

  await buildPublicIcons();
}

/**
 * Favicons and the Open Graph share image.
 *
 * These live in public/ because they're referenced by absolute path from <head>
 * and by crawlers that never see the bundler.
 *
 * Note: no favicon.svg. The logo only exists as raster, so shipping a "vector"
 * favicon would mean embedding a bitmap in an SVG wrapper -- all of the size,
 * none of the sharpness. Roadmap 0.4 asks Edward's designer for the real SVG;
 * until it arrives, PNG at several sizes is the honest option.
 */
async function buildPublicIcons() {
  await mkdir("public", { recursive: true });

  const mark = `${OUT}/mark-initial.png`;
  const lockup = `${OUT}/lockup.png`;

  // Favicons: the mark on cream, with breathing room so it survives being
  // scaled to 16px in a browser tab.
  for (const size of [32, 180, 192, 512]) {
    const pad = Math.round(size * 0.12);
    const name = size === 180 ? "apple-touch-icon.png" : `favicon-${size}.png`;
    await sharp(mark)
      .resize(size - pad * 2, size - pad * 2, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: CREAM })
      .flatten({ background: CREAM })
      .png()
      .toFile(`public/${name}`);
    console.log(`public/${name}`);
  }

  // Open Graph: 1200x630, the lockup centred on cream. Links to this site get
  // texted and posted to Facebook constantly, so the preview matters more than
  // it would for most small sites.
  await sharp({
    create: { width: 1200, height: 630, channels: 4, background: CREAM },
  })
    .composite([{ input: await sharp(lockup).resize({ height: 460, fit: "inside" }).toBuffer(), gravity: "centre" }])
    .png()
    .toFile("public/og-default.png");
  console.log("public/og-default.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
