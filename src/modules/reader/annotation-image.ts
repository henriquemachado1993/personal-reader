export async function prepareAnnotationImage(file: File) {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Escolha uma imagem de até 20 MB.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "Não foi possível abrir esta imagem. Tente PNG, JPEG ou WebP.",
    );
  }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return {
      source: canvas.toDataURL("image/webp", 0.85),
      width: canvas.width,
      height: canvas.height,
      name: file.name,
    };
  } finally {
    bitmap.close();
  }
}
