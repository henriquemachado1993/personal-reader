/** Raster text preserves browser font fallback (including emoji) without destructive transliteration. */
export async function renderUnicodeNote(text: string, tint: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  const context = canvas.getContext("2d")!;
  context.font = "32px sans-serif";
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const symbol of Array.from(paragraph)) {
      if (context.measureText(line + symbol).width > 1160) {
        lines.push(line);
        line = "";
      }
      line += symbol;
    }
    lines.push(line);
  }
  canvas.height = Math.max(60, lines.length * 42 + 20);
  context.font = "32px sans-serif";
  context.fillStyle = tint;
  lines.forEach((line, i) => context.fillText(line, 10, 36 + i * 42));
  return {
    bytes: await (await fetch(canvas.toDataURL("image/png"))).arrayBuffer(),
    aspect: canvas.height / canvas.width,
  };
}
