import { assetIdPattern } from "@/infrastructure/r2/file-key";
import {
  getStorageScope,
  readCachedFile,
  readFile,
  saveFile,
} from "@/infrastructure/storage/local";

const localWrites = new Map<string, Promise<Blob>>();
const downloads = new Map<string, Promise<Blob | undefined>>();
const assetKey = (ownerId: string, id: string) => `${ownerId}/${id}`;

export async function saveLibraryAsset(
  blob: Blob,
  ownerId = getStorageScope(),
) {
  const id = `asset-${crypto.randomUUID()}`;
  await saveFile(id, blob, ownerId);
  return id;
}

export function stageImageAsset(source: string, reportError: () => void) {
  const [header, payload] = source.split(",", 2);
  const mime = /^data:(image\/[a-z]+);base64$/.exec(header)?.[1];
  if (!mime || !payload) return undefined;
  const blob = new Blob(
    [Uint8Array.from(atob(payload), (character) => character.charCodeAt(0))],
    { type: mime },
  );
  const id = `asset-${crypto.randomUUID()}`;
  const ownerId = getStorageScope();
  const key = assetKey(ownerId, id);
  const write = saveFile(id, blob, ownerId).then(() => blob);
  localWrites.set(key, write);
  void write.then(
    () => localWrites.delete(key),
    () => {
      reportError();
      localWrites.delete(key);
    },
  );
  return id;
}

export function readUnsentAsset(id: string, ownerId: string) {
  return localWrites.get(assetKey(ownerId, id)) ?? readCachedFile(id, ownerId);
}

export function readLibraryAsset(id: string, ownerId = getStorageScope()) {
  const key = assetKey(ownerId, id);
  const existing = localWrites.get(key) ?? downloads.get(key);
  if (existing) return existing;
  const download = readFile(id, ownerId).finally(() => downloads.delete(key));
  downloads.set(key, download);
  return download;
}

export async function portableAssetSource(
  reference: string,
  ownerId = getStorageScope(),
) {
  if (!assetIdPattern.test(reference)) return reference;
  const blob = await readLibraryAsset(reference, ownerId);
  if (!blob) throw new Error("Um arquivo está indisponível para a exportação.");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function readDocumentContent(
  id: string,
  ownerId = getStorageScope(),
) {
  const blob = await readLibraryAsset(id, ownerId);
  if (!blob)
    throw new Error(
      "O texto deste documento ainda não está disponível neste aparelho.",
    );
  const content: unknown = JSON.parse(await blob.text());
  if (
    !Array.isArray(content) ||
    !content.every((page) => typeof page === "string")
  )
    throw new Error("Não foi possível abrir o texto deste documento.");
  return content as string[];
}
