"use client";
import { useEffect } from "react";
import { useLibrary } from "@/modules/library/store";
import { flushReadingProgress } from "@/modules/library/progress-upload";
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
      void navigator.serviceWorker.register(
        `/sw.js?v=${process.env.NEXT_PUBLIC_CACHE_VERSION}`,
      );
  }, [userId, name, hydrate]);
  useEffect(() => {
    if (!hydrated) return;
    const synchronize = () => void useLibrary.getState().synchronize();
    let scheduled: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useLibrary.subscribe((state, before) => {
      if (state.changeVersion === before.changeVersion || scheduled) return;
      // A bounded delay also sends changes during continuous reading or annotation.
      scheduled = setTimeout(() => {
        scheduled = undefined;
        synchronize();
      }, 750);
    });
    const leaving = () => {
      flushReadingProgress(useLibrary.getState().documents);
      synchronize();
    };
    const visibilityChanged = () =>
      document.visibilityState === "hidden" ? leaving() : synchronize();
    synchronize();
    const timer = setInterval(synchronize, 15000);
    window.addEventListener("online", synchronize);
    window.addEventListener("focus", synchronize);
    window.addEventListener("pagehide", leaving);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      clearInterval(timer);
      clearTimeout(scheduled);
      unsubscribe();
      window.removeEventListener("online", synchronize);
      window.removeEventListener("focus", synchronize);
      window.removeEventListener("pagehide", leaving);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [hydrated]);
  return hydrated && ownerId === userId ? (
    children
  ) : (
    <div className="reader-loading">Preparando sua biblioteca…</div>
  );
}
