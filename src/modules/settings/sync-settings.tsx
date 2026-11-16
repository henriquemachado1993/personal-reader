"use client";
import { useState } from "react";
import { Check, Cloud, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/controls";
import { useLibrary } from "@/modules/library/store";
import { exportLibraryBackup } from "./library-backup";

export function SyncSettings() {
  const { syncMessage, lastSyncedAt, synchronize } = useLibrary();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const conflict = /Conflito/.test(syncMessage);
  const complete = syncMessage === "Biblioteca sincronizada.";
  const Icon = conflict ? AlertCircle : complete ? Check : Cloud;
  const resolve = async (preferLocal: boolean) => {
    setBusy(true);
    setError("");
    try {
      exportLibraryBackup();
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
          <Icon size={16} />
          {busy
            ? "Em andamento"
            : conflict
              ? "Revisar alterações"
              : complete
                ? "Em dia"
                : "Pendente"}
        </span>
      </div>
      <div className="settings-sync-content" aria-busy={busy}>
        <p role="status">
          {busy ? "Atualizando sua biblioteca…" : syncMessage}
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
                disabled={busy}
                onClick={() => void resolve(true)}
              >
                Manter deste dispositivo
              </Button>
              <Button
                className="button secondary"
                disabled={busy}
                onClick={() => void resolve(false)}
              >
                Usar versão da conta
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="button secondary settings-sync-button"
            disabled={busy}
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
            <RefreshCw size={16} />
            {busy ? "Sincronizando…" : "Sincronizar agora"}
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
