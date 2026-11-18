import { test } from "node:test";
import assert from "node:assert/strict";
import { syncPresentation } from "../src/modules/settings/sync-presentation";

for (const [message, state, label] of [
  ["Biblioteca sincronizada.", "synced", "Em dia"],
  ["Alterações salvas neste navegador.", "pending", "Pendente"],
  [
    "Alterações salvas neste navegador. Sincronização pendente.",
    "pending",
    "Pendente",
  ],
  ["Novas alterações locais aguardam sincronização.", "pending", "Pendente"],
  [
    "Há arquivos pendentes de envio. Suas alterações continuam neste navegador.",
    "pending",
    "Arquivos pendentes",
  ],
  [
    "Conflito de sincronização. Exporte os dados locais antes de resolver.",
    "conflict",
    "Revisar alterações",
  ],
  [
    "Sincronização indisponível. Suas alterações continuam neste navegador.",
    "error",
    "Falha na sincronização",
  ],
  [
    "Sua sessão não permite sincronizar. Exporte um backup local.",
    "error",
    "Falha na sincronização",
  ],
  [
    "Não foi possível salvar a sincronização neste navegador.",
    "error",
    "Falha na sincronização",
  ],
  [
    "A biblioteca ultrapassou o limite de 25 MB de metadados.",
    "error",
    "Falha na sincronização",
  ],
] as const) {
  test(`sync indicator: ${label} for ${message}`, () => {
    assert.deepEqual(syncPresentation({ message, busy: false, online: true }), {
      state,
      label,
    });
  });
}

test("automatic or manual synchronization replaces an old success indicator", () => {
  assert.deepEqual(
    syncPresentation({
      message: "Biblioteca sincronizada.",
      busy: true,
      online: true,
    }),
    { state: "syncing", label: "Em andamento" },
  );
});
test("losing the connection replaces even an old successful or busy indicator", () => {
  for (const busy of [false, true])
    assert.deepEqual(
      syncPresentation({
        message: "Biblioteca sincronizada.",
        busy,
        online: false,
      }),
      { state: "offline", label: "Sem conexão" },
    );
});
test("a failed conflict resolution does not keep the success indicator", () => {
  assert.deepEqual(
    syncPresentation({
      message: "Biblioteca sincronizada.",
      busy: false,
      online: true,
      error: "Não foi possível concluir.",
    }),
    { state: "error", label: "Falha na sincronização" },
  );
});
