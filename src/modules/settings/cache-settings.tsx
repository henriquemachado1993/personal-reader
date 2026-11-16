"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/controls";
import { clearAppCache, measureAppCache, formatCacheSize } from "./app-cache";

export function CacheSettings({ onCleared }: { onCleared: () => void }) {
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const running = useRef(false);
  const [cacheBytes, setCacheBytes] = useState<number | null>(null);
  const [sizeUnavailable, setSizeUnavailable] = useState(false);
  const measurement = useRef<AbortController | null>(null);
  const refreshSize = useCallback(async () => {
    measurement.current?.abort();
    const controller = new AbortController();
    measurement.current = controller;
    setCacheBytes(null);
    setSizeUnavailable(false);
    try {
      const bytes = await measureAppCache(window.caches, controller.signal);
      if (!controller.signal.aborted) setCacheBytes(bytes);
    } catch {
      if (!controller.signal.aborted) setSizeUnavailable(true);
    }
  }, []);
  useEffect(() => {
    const available = "caches" in window;
    setSupported(available);
    if (available) void refreshSize();
    return () => measurement.current?.abort();
  }, [refreshSize]);
  return (
    <>
      <div className="preference-row">
        <div>
          <h3>Cache do aplicativo</h3>
          <p id="cache-settings-description">
            Remove arquivos temporários sem apagar livros, anotações, progresso
            ou preferências. Algumas páginas precisarão ser abertas com conexão
            novamente para funcionar offline.
          </p>
          {supported && (
            <p aria-live="polite" className="settings-cache-size">
              {sizeUnavailable
                ? "Tamanho do cache indisponível"
                : cacheBytes === null
                  ? "Calculando tamanho do cache…"
                  : `Tamanho aproximado: ${formatCacheSize(cacheBytes)}`}
            </p>
          )}
        </div>
        <Button
          type="button"
          className="button secondary"
          aria-describedby="cache-settings-description"
          disabled={busy || !supported}
          aria-busy={busy}
          onClick={async () => {
            if (running.current) return;
            running.current = true;
            measurement.current?.abort();
            setBusy(true);
            setMessage("");
            setFailed(false);
            try {
              await clearAppCache(window.caches);
              setMessage(
                "Cache limpo. Seus livros e anotações foram preservados.",
              );
              onCleared();
            } catch {
              setFailed(true);
              setMessage(
                "Não foi possível concluir a limpeza do cache. Tente novamente.",
              );
            } finally {
              running.current = false;
              setBusy(false);
              void refreshSize();
            }
          }}
        >
          {busy ? "Limpando…" : "Limpar cache"}
        </Button>
      </div>
      <p role={failed ? "alert" : "status"}>
        {supported
          ? message
          : "A limpeza de cache não está disponível neste navegador."}
      </p>
    </>
  );
}
