export async function uploadOriginal(
  id: string,
  original: Blob,
): Promise<void> {
  const failure = () =>
    new Error(
      "Não foi possível enviar os originais. A sincronização tentará novamente.",
    );
  const authorization = await fetch(
    `/api/library/files/${encodeURIComponent(id)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ size: original.size }),
      cache: "no-store",
    },
  );
  if (!authorization.ok) throw failure();
  const transfer: { exists?: boolean; url?: string } =
    await authorization.json();
  if (transfer.exists) return;
  if (!transfer.url) throw failure();
  const uploaded = await fetch(transfer.url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
      "If-None-Match": "*",
    },
    body: original,
    credentials: "omit",
  });
  // Another device may have completed the immutable upload after authorization.
  if (!uploaded.ok && uploaded.status !== 412) throw failure();
}
