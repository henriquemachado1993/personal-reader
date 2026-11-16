import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const icon = await readFile(new URL("../src/app/icon.svg", import.meta.url));
const destination = new URL("../public/icons/", import.meta.url);
await mkdir(destination, { recursive: true });
const faviconImages = await Promise.all(
  [16, 32, 48].map((size) => sharp(icon).resize(size, size).png().toBuffer()),
);
const faviconHeader = Buffer.alloc(6 + faviconImages.length * 16);
faviconHeader.writeUInt16LE(1, 2);
faviconHeader.writeUInt16LE(faviconImages.length, 4);
let faviconOffset = faviconHeader.length;
faviconImages.forEach((png, index) => {
  const entry = 6 + index * 16;
  const size = [16, 32, 48][index];
  faviconHeader[entry] = size;
  faviconHeader[entry + 1] = size;
  faviconHeader.writeUInt16LE(1, entry + 4);
  faviconHeader.writeUInt16LE(32, entry + 6);
  faviconHeader.writeUInt32LE(png.length, entry + 8);
  faviconHeader.writeUInt32LE(faviconOffset, entry + 12);
  faviconOffset += png.length;
});
await writeFile(
  new URL("../src/app/favicon.ico", import.meta.url),
  Buffer.concat([faviconHeader, ...faviconImages]),
);
for (const [name, size] of [
  ["app-192", 192],
  ["app-512", 512],
  ["apple-touch-icon", 180],
]) {
  await sharp(icon)
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(`${name}.png`, destination)));
}
// Keep the existing book mark inside the maskable icon's central safe circle.
const mark = await sharp(icon).resize(320, 320).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#242424" },
})
  .composite([{ input: mark, gravity: "centre" }])
  .png()
  .toFile(fileURLToPath(new URL("app-maskable-512.png", destination)));
