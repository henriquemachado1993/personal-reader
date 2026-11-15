export function isUnreferencedOriginal(ownerId, key, snapshot) {
  const prefix = `${ownerId}/originals/`;
  if (!key.startsWith(prefix)) return false;
  const id = key.slice(prefix.length);
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) return false;
  // Missing or malformed snapshots are never sufficient evidence for permanent deletion.
  if (!snapshot || !Array.isArray(snapshot.documents)) return false;
  return !snapshot.documents.some(book => book.id === id);
}
