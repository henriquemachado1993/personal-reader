export const assetIdPattern =
  /^asset-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function fileKey(ownerId: string, id: string) {
  const folder = assetIdPattern.test(id) ? "assets" : "originals";
  return `${ownerId}/${folder}/${id}`;
}

export function uploadType(id: string, requested: unknown) {
  if (!assetIdPattern.test(id)) return "application/octet-stream";
  return typeof requested === "string" &&
    /^(application\/json|image\/(png|jpeg|webp|gif|avif))$/.test(requested)
    ? requested
    : null;
}
