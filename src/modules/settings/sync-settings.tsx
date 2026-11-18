"use client";
import { useState, useSyncExternalStore } from "react";
import {
  CloudCheck,
  CloudSync,
  CloudUpload,
  CloudOff,
  CloudAlert,
} from "lucide-react";
import { Button } from "@/components/ui/controls";
import { useLibrary } from "@/modules/library/store";
import { exportLibraryBackup } from "./library-backup";
import { syncPresentation } from "./sync-presentation";

const syncIcons = {
  synced: CloudCheck,
  pending: CloudUpload,
  syncing: CloudSync,
  offline: CloudOff,
  conflict: CloudAlert,
  error: CloudAlert,
};

function subscribeToConnection(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}

export function SyncSettings() {
  const { syncMessage, lastSyncedAt, synchronize, synchronizing } =
    useLibrary();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const conflict = /Conflito/.test(syncMessage);
  const online = useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true,
  );
  const active = busy || synchronizing;
  const presentation = syncPresentation({
    message: syncMessage,
    busy: active,
    online,
    error,
  });
  const Icon = syncIcons[presentation.state];
  const resolve = async (preferLocal: boolean) => {
    setBusy(true);
    setError("");
    try {
      await exportLibraryBackup();
      await useLibrary.getState().resolveConflict(preferLocal);
    } catch {
      setError(
        "Não foi possível concluir. Seus dados neste dispositivo foram preservados. Reconecte-se e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="preferences-section"
      aria-labelledby="sync-settings-title"
    >
      <div className="preferences-section-heading">
        <h2 id="sync-settings-title">Sincronização</h2>
        <span className="sync-state">
          <Icon size={16} aria-hidden="true" />
          {presentation.label}
        </span>
      </div>
      <div className="settings-sync-content" aria-busy={active && online}>
        <p role="status">
          {!online
            ? "Sem conexão. Suas alterações continuam salvas neste navegador."
            : active
              ? "Atualizando sua biblioteca…"
              : syncMessage}
        </p>
        {lastSyncedAt && (
          <p className="settings-sync-date">
            Última conclusão:{" "}
            <time dateTime={lastSyncedAt}>
              {new Date(lastSyncedAt).toLocaleString("pt-BR")}
            </time>
          </p>
        )}
        {conflict ? (
          <div className="settings-conflict">
            <strong>Qual versão você quer manter?</strong>
            <p>
              Este dispositivo e sua conta têm alterações diferentes. Baixaremos
              um backup deste dispositivo antes de aplicar sua escolha.
            </p>
            <div className="settings-action-row">
              <Button
                className="button secondary"
                disabled={active || !online}
                onClick={() => void resolve(true)}
              >
                Manter deste dispositivo
              </Button>
              <Button
                className="button secondary"
                disabled={active || !online}
                onClick={() => void resolve(false)}
              >
                Usar versão da conta
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="button secondary settings-sync-button"
            disabled={active || !online}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await synchronize();
              } finally {
                setBusy(false);
              }
            }}
          >
            {active ? "Sincronizando…" : "Sincronizar agora"}
          </Button>
        )}
        {error && (
          <p role="alert" className="settings-action-error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
