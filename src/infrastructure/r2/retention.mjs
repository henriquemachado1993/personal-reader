export function isUnreferencedOriginal(ownerId, key, snapshot) {
  const prefix = `${ownerId}/originals/`;
  if (!key.startsWith(prefix)) return false;
  const id = key.slice(prefix.length);
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) return false;
  // Missing or malformed snapshots are never sufficient evidence for permanent deletion.
  if (!snapshot || !Array.isArray(snapshot.documents)) return false;
  return !snapshot.documents.some((book) => book.id === id);
}
export function isExpiredSnapshotTransfer(key, lastModified, now = new Date()) {
  return (
    /^sync-snapshots\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(key ?? "") &&
    lastModified instanceof Date &&
    Number.isFinite(lastModified.getTime()) &&
    now.getTime() - lastModified.getTime() > 7 * 24 * 60 * 60 * 1000
  );
}
