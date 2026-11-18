"use client";
import { useEffect } from "react";
import { useLibrary } from "@/modules/library/store";
import { localResetKey } from "@/modules/library/local-edit-journal";
import { followLibraryRevisions } from "@/modules/library/realtime";

export function LibraryIdentity({
  userId,
  name,
  children,
}: {
  userId: string;
  name: string;
  children: React.ReactNode;
}) {
  const hydrate = useLibrary((state) => state.hydrate);
  const hydrated = useLibrary((state) => state.hydrated);
  const ownerId = useLibrary((state) => state.ownerId);
  useEffect(() => {
    void hydrate(userId, name);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      void navigator.serviceWorker.register(
        `/sw.js?v=${process.env.NEXT_PUBLIC_CACHE_VERSION}`,
      );
  }, [userId, name, hydrate]);

  useEffect(() => {
    if (!hydrated || ownerId !== userId) return;
    let writeTimer: ReturnType<typeof setTimeout> | undefined;
    let pullTimer: ReturnType<typeof setTimeout> | undefined;
    let newestRevision = 0;
    let reconcileConnection = false;
    const schedulePull = (force: boolean) => {
      reconcileConnection ||= force;
      if (pullTimer) return;
      pullTimer = setTimeout(() => {
        pullTimer = undefined;
        void useLibrary
          .getState()
          .synchronize({ pull: true, includeReadingTime: false });
      }, 100);
    };
    const pull = () => schedulePull(true);
    const onNetwork = () => {
      clearTimeout(pullTimer);
      pullTimer = undefined;
      reconcileConnection = false;
      void useLibrary.getState().synchronize({ pull: true });
    };
    const unsubscribe = useLibrary.subscribe((state, before) => {
      if (state.changeVersion === before.changeVersion || writeTimer) return;
      writeTimer = setTimeout(() => {
        writeTimer = undefined;
        void useLibrary.getState().synchronize({ pull: false });
      }, 750);
    });
    const disconnect = followLibraryRevisions(userId, (revision) => {
      if (revision === undefined) {
        pull();
        return;
      }
      if (revision <= Math.max(newestRevision, useLibrary.getState().revision))
        return;
      newestRevision = revision;
      schedulePull(false);
    });
    const leaving = () => useLibrary.getState().flush();
    const onVisibility = () =>
      document.visibilityState === "hidden" ? leaving() : pull();
    const localDataReset = (event: StorageEvent) => {
      if (event.key !== localResetKey(userId) || !event.newValue) return;
      useLibrary.getState().suspendLocalWrites();
      window.location.reload();
    };
    pull();
    window.addEventListener("storage", localDataReset);
    window.addEventListener("online", onNetwork);
    window.addEventListener("focus", pull);
    window.addEventListener("pagehide", leaving);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(writeTimer);
      clearTimeout(pullTimer);
      unsubscribe();
      disconnect();
      window.removeEventListener("storage", localDataReset);
      window.removeEventListener("online", onNetwork);
      window.removeEventListener("focus", pull);
      window.removeEventListener("pagehide", leaving);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hydrated, ownerId, userId]);

  return hydrated && ownerId === userId ? (
    children
  ) : (
    <div className="reader-loading">Preparando sua biblioteca…</div>
  );
}
