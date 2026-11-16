import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const icon = await readFile(new URL("../src/app/icon.svg", import.meta.url));
const destination = new URL("../public/icons/", import.meta.url);
await mkdir(destination, { recursive: true });
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
