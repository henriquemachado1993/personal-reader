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
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      void navigator.serviceWorker.register("/sw.js");
  }, [userId, name, hydrate]);
  useEffect(() => {
    if (!hydrated) return;
    const synchronize = () => void useLibrary.getState().synchronize();
    synchronize();
    const timer = setInterval(synchronize, 15000);
    window.addEventListener("online", synchronize);
    window.addEventListener("focus", synchronize);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", synchronize);
      window.removeEventListener("focus", synchronize);
    };
  }, [hydrated]);
  return hydrated && ownerId === userId ? (
    children
  ) : (
    <div className="reader-loading">Preparando sua biblioteca…</div>
  );
}
