import type { LibraryState } from "@/shared/types";

export async function saveLibrarySnapshot(payload: {
  revision: number;
  operationId: string;
  snapshot: LibraryState;
}): Promise<Response> {
  const body = JSON.stringify(payload);
  let requestBody = body;
  if (new Blob([body]).size > 4_000_000) {
    const snapshot = new Blob([JSON.stringify(payload.snapshot)], {
      type: "application/octet-stream",
    });
    if (snapshot.size > 25_000_000)
      throw new Error(
        "A biblioteca ultrapassou o limite de 25 MB de metadados. A cópia local está preservada.",
      );
    const authorization = await fetch(
      `/api/library/snapshots/${payload.operationId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: snapshot.size }),
      },
    );
    if (!authorization.ok)
      throw new Error(
        "Não foi possível preparar a sincronização. A cópia local está preservada.",
      );
    const { url } = await authorization.json();
    const uploaded = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
        "If-None-Match": "*",
      },
      body: snapshot,
      credentials: "omit",
    });
    if (!uploaded.ok && uploaded.status !== 412)
      throw new Error(
        "Não foi possível enviar a biblioteca. A cópia local está preservada.",
      );
    requestBody = JSON.stringify({
      revision: payload.revision,
      operationId: payload.operationId,
      snapshotId: payload.operationId,
    });
  }
  return fetch("/api/library", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
  });
}
