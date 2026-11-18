"use client";
import { useRef, useState } from "react";
import { Modal } from "@/components/ui";
import { Button } from "@/components/ui/controls";
import { useLibrary } from "@/modules/library/store";

export function ResetLocalSettings() {
  const resetLocal = useLibrary((state) => state.resetLocal);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);

  return (
    <div className="preference-row">
      <div>
        <h3>Dados locais deste navegador</h3>
        <p>Limpe os dados locais desta conta e baixe a biblioteca novamente.</p>
      </div>
      <Button
        className="button secondary"
        onClick={() => {
          setError("");
          setOpened(true);
        }}
      >
        Limpar dados locais
      </Button>
      <Modal
        opened={opened}
        title="Limpar dados locais?"
        onClose={() => {
          if (!running.current) setOpened(false);
        }}
      >
        <p>
          Alterações ainda pendentes de sincronização serão descartadas. Os
          arquivos offline serão baixados conforme você abrir os livros
          novamente. A biblioteca salva na conta será usada para reconstruir os
          dados locais.
        </p>
        <div className="settings-action-row">
          <Button
            className="button secondary"
            disabled={busy}
            onClick={() => setOpened(false)}
          >
            Cancelar
          </Button>
          <Button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              if (running.current) return;
              running.current = true;
              setBusy(true);
              setError("");
              try {
                await resetLocal();
                window.location.reload();
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Não foi possível limpar os dados locais.",
                );
                running.current = false;
                setBusy(false);
              }
            }}
          >
            {busy ? "Reconstruindo…" : "Limpar e ressincronizar"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="settings-action-error">
            {error}
          </p>
        )}
      </Modal>
    </div>
  );
}
