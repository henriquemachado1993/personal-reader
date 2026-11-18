import { RealtimeClient } from "@supabase/realtime-js";

export function followLibraryRevisions(
  ownerId: string,
  onRevision: (revision?: number) => void,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return () => {};
  const controller = new AbortController();
  let credentials: { token: string; expiresAt: number } | undefined;
  let request: Promise<string | null> | undefined;
  const client = new RealtimeClient(`${url.replace(/\/$/, "")}/realtime/v1`, {
    params: { apikey: key },
    accessToken: () => {
      if (credentials && credentials.expiresAt - Date.now() > 60_000)
        return Promise.resolve(credentials.token);
      request ??= fetch("/api/library/realtime", {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) return null;
          const { token, expiresIn } = await response.json();
          credentials = { token, expiresAt: Date.now() + expiresIn * 1000 };
          return token as string;
        })
        .catch(() => null)
        .finally(() => {
          request = undefined;
        });
      return request;
    },
  });
  let connected = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  const subscribe = async () => {
    if (controller.signal.aborted || connected || !navigator.onLine) return;
    await client.setAuth();
    if (controller.signal.aborted || connected) return;
    if (!client.accessTokenValue) {
      if (++attempts < 4)
        retry = setTimeout(() => void subscribe(), 1000 * 2 ** attempts);
      return;
    }
    connected = true;
    client
      .channel(`library:${ownerId}`, { config: { private: true } })
      .on("broadcast", { event: "revision" }, ({ payload }) => {
        if (
          !controller.signal.aborted &&
          Number.isSafeInteger(payload?.revision)
        )
          onRevision(payload.revision);
      })
      .subscribe((status) => {
        if (!controller.signal.aborted && status === "SUBSCRIBED") onRevision();
      });
  };
  const reconnect = () => {
    clearTimeout(retry);
    attempts = 0;
    void subscribe();
  };
  void subscribe();
  window.addEventListener("online", reconnect);
  return () => {
    controller.abort();
    clearTimeout(retry);
    window.removeEventListener("online", reconnect);
    client.disconnect();
    void client.removeAllChannels();
  };
}
