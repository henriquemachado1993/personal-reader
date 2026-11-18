type SyncIndicatorState =
  "synced" | "pending" | "syncing" | "offline" | "conflict" | "error";

export function syncPresentation({
  message,
  busy,
  online,
  error = "",
}: {
  message: string;
  busy: boolean;
  online: boolean;
  error?: string;
}): { state: SyncIndicatorState; label: string } {
  if (!online) return { state: "offline", label: "Sem conexão" };
  if (busy) return { state: "syncing", label: "Em andamento" };
  if (error) return { state: "error", label: "Falha na sincronização" };
  if (message.startsWith("Conflito"))
    return { state: "conflict", label: "Revisar alterações" };
  if (message === "Biblioteca sincronizada.")
    return { state: "synced", label: "Em dia" };
  if (
    message ===
    "Há arquivos pendentes de envio. Suas alterações continuam neste navegador."
  )
    return { state: "pending", label: "Arquivos pendentes" };
  if (
    [
      "Alterações salvas neste navegador.",
      "Alterações salvas neste navegador. Sincronização pendente.",
      "Novas alterações locais aguardam sincronização.",
    ].includes(message)
  )
    return { state: "pending", label: "Pendente" };
  return { state: "error", label: "Falha na sincronização" };
}
