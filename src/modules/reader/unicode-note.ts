import { wrapAnnotationText } from "./annotation-objects";

/** Raster text preserves browser font fallback (including emoji) without destructive transliteration. */
export async function renderUnicodeNote(
  text: string,
  tint: string,
  options?: { width: number; fontSize: number },
) {
  const canvas = document.createElement("canvas");
  canvas.width = options?.width ?? 1200;
  const context = canvas.getContext("2d")!;
  const fontSize = options?.fontSize ?? 32;
  const padding = options ? fontSize * 0.25 : 10;
  const font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  context.font = font;
  const lines = wrapAnnotationText(
    text,
    canvas.width - padding * 2,
    (value) => context.measureText(value).width,
  );
  canvas.height = Math.max(
    1,
    Math.ceil(lines.length * fontSize * 1.35 + padding * 2),
  );
  context.font = font;
  context.fillStyle = tint;
  lines.forEach((line, i) =>
    context.fillText(line, padding, padding + fontSize + i * fontSize * 1.35),
  );
  return {
    bytes: await (await fetch(canvas.toDataURL("image/png"))).arrayBuffer(),
    aspect: canvas.height / canvas.width,
  };
}
