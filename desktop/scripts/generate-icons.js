/**
 * Regenerates Windows app icons from the Brewtl brand asset.
 * Does not touch CRM application logic.
 */
const fs = require("fs");
const path = require("path");

async function main() {
  const sharp = require("sharp");
  let pngToIco = require("png-to-ico");
  if (pngToIco.default) pngToIco = pngToIco.default;

  const root = path.join(__dirname, "..");
  const src = path.join(root, "..", "frontend", "public", "logo.png");
  const buildDir = path.join(root, "build");
  const outPng = path.join(buildDir, "icon.png");
  const outIco = path.join(buildDir, "icon.ico");

  if (!fs.existsSync(src)) {
    throw new Error(`Brand asset missing: ${src}`);
  }
  fs.mkdirSync(buildDir, { recursive: true });

  const size = 1024;
  const pad = Math.round(size * 0.08);
  const inner = size - pad * 2;
  const logoBuf = await sharp(src)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 16, g: 24, b: 32, alpha: 1 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 16, g: 24, b: 32, alpha: 1 },
    },
  })
    .composite([{ input: logoBuf, gravity: "centre" }])
    .png()
    .toFile(outPng);

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const tmp = [];
  for (const s of sizes) {
    const p = path.join(buildDir, `tmp-${s}.png`);
    await sharp(outPng).resize(s, s).ensureAlpha().png().toFile(p);
    tmp.push(p);
  }
  const ico = await pngToIco(tmp);
  fs.writeFileSync(outIco, ico);
  for (const p of tmp) fs.unlinkSync(p);

  console.log(`Wrote ${outPng}`);
  console.log(`Wrote ${outIco} (${ico.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
