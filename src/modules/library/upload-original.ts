import { assetIdPattern } from "@/infrastructure/r2/file-key";

export async function uploadOriginal(
  id: string,
  original: Blob,
): Promise<void> {
  const type = assetIdPattern.test(id)
    ? original.type
    : "application/octet-stream";
  const authorization = await fetch(
    `/api/library/files/${encodeURIComponent(id)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ size: original.size, type }),
      cache: "no-store",
    },
  );
  if (!authorization.ok)
    throw new Error("Não foi possível autorizar o envio do arquivo.");
  const transfer: { exists?: boolean; url?: string } =
    await authorization.json();
  if (transfer.exists) return;
  if (!transfer.url)
    throw new Error("O endereço de envio do arquivo está indisponível.");
  const uploaded = await fetch(transfer.url, {
    method: "PUT",
    headers: { "Content-Type": type, "If-None-Match": "*" },
    body: original,
    credentials: "omit",
  });
  if (!uploaded.ok && uploaded.status !== 412)
    throw new Error("Não foi possível enviar o arquivo.");
}
