"use client";
import { useEffect } from "react";
import { useLibrary } from "@/modules/library/store";
export function LibraryIdentity({
  userId,
  name,
  children,
}: {
  userId: string;
  name: string;
  children: React.ReactNode;
}) {
  const hydrate = useLibrary((s) => s.hydrate);
  const hydrated = useLibrary((s) => s.hydrated);
  const ownerId = useLibrary((s) => s.ownerId);
  useEffect(() => {
    void hydrate(userId, name);
  }, [userId, name, hydrate]);
  return hydrated && ownerId === userId ? (
    children
  ) : (
    <div className="reader-loading">Preparando sua biblioteca…</div>
  );
}
