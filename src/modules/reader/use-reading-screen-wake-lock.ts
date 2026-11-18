import { useEffect } from "react";

export function useReadingScreenWakeLock(reading: boolean) {
  useEffect(() => {
    const screenWakeLock = navigator.wakeLock;
    if (!reading || !screenWakeLock) return;

    let stopped = false;
    let requesting = false;
    let screenLock: WakeLockSentinel | undefined;

    async function updateScreenWakeLock() {
      if (document.visibilityState !== "visible") {
        void screenLock?.release();
        screenLock = undefined;
        return;
      }
      if (requesting || screenLock?.released === false) return;

      requesting = true;
      try {
        const acquiredLock = await screenWakeLock.request("screen");
        if (stopped || document.visibilityState !== "visible") {
          await acquiredLock.release();
        } else {
          screenLock = acquiredLock;
        }
      } catch {
        // The browser may deny wake locks, for example in low power mode.
      } finally {
        requesting = false;
      }
    }

    document.addEventListener("visibilitychange", updateScreenWakeLock);
    void updateScreenWakeLock();
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", updateScreenWakeLock);
      void screenLock?.release();
    };
  }, [reading]);
}
