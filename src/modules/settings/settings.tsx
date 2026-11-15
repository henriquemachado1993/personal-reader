"use client";
import { useEffect, useState } from "react";
import {
  Sun,
  Moon,
  Monitor,
  HardDrive,
  Download,
  BookOpen,
  Clock,
  CheckCheck,
  ArrowUpRight,
  Database,
  Cloud,
} from "lucide-react";
import { useLibrary } from "@/modules/library/store";
import { downloadBlob } from "@/modules/reader/export";
import { resolveLibraryConflict } from "@/modules/library/synchronize";
import { writeState } from "@/infrastructure/storage/local";
export function SettingsView() {
  const state = useLibrary();
  const [usage, setUsage] = useState("");
  const [config, setConfig] = useState<{
    database: boolean;
    storage: boolean;
  } | null>(null);
  useEffect(() => {
    void navigator.storage
      ?.estimate()
      .then((s) => setUsage(`${((s.usage ?? 0) / 1024 / 1024).toFixed(1)} MB`));
    fetch("/api/status")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
  }, []);
  const exportData = () => {
    const {
      documents,
      annotations,
      collections,
      bookmarks,
      preferences,
      readingSeconds,
    } = state;
    downloadBlob(
      new Blob(
        [
          JSON.stringify(
            {
              version: 1,
              exportedAt: new Date().toISOString(),
              documents,
              annotations,
              collections,
              bookmarks,
              preferences,
              readingSeconds,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      "personal-reader-backup.json",
    );
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Do seu jeito</h1>
          <p>Pequenos ajustes para uma leitura que combina com você.</p>
        </div>
      </div>
      <div className="settings-content">
        <section aria-label="Sincronização">
          <h2>Seu acervo em todos os dispositivos</h2>
          <p role="status">{state.syncMessage}</p>
          <button
            className="button secondary"
            onClick={() => void state.synchronize()}
          >
            Sincronizar agora
          </button>
          {/Conflito/.test(state.syncMessage) && (
            <div>
              <p>Uma cópia JSON será baixada antes de aplicar sua escolha.</p>
              {[true, false].map((preferLocal) => (
                <button
                  key={String(preferLocal)}
                  className="button secondary"
                  onClick={async () => {
                    exportData();
                    try {
                      const replacement =
                        await resolveLibraryConflict(preferLocal);
                      if (replacement) {
                        await writeState(replacement);
                        useLibrary.setState(replacement);
                      }
                      await useLibrary.getState().synchronize();
                    } catch {
                      state.notify(
                        "Não foi possível resolver agora. Sua cópia local foi preservada.",
                      );
                    }
                  }}
                >
                  {preferLocal ? "Manter esta versão" : "Usar versão da conta"}
                </button>
              ))}
            </div>
          )}
        </section>
        <section>
          <h2>Aparência</h2>
          <p>Escolha como quer ver a sua biblioteca.</p>
          <div className="theme-selector">
            {(
              [
                { id: "light", label: "Claro", icon: Sun },
                { id: "dark", label: "Escuro", icon: Moon },
                { id: "system", label: "Sistema", icon: Monitor },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={state.preferences.theme === id ? "active" : ""}
                aria-pressed={state.preferences.theme === id}
                onClick={() => state.setPreferences({ theme: id })}
              >
                <Icon size={21} strokeWidth={1.5} />
                {label}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h2>Seu ritmo de leitura</h2>
          <div className="setting-row">
            <div>
              <strong>Meta diária</strong>
              <p>Um convite para reservar alguns minutos para você.</p>
            </div>
            <label>
              <select
                className="input"
                aria-label="Meta diária em minutos"
                value={state.preferences.dailyGoal}
                onChange={(e) =>
                  state.setPreferences({ dailyGoal: Number(e.target.value) })
                }
              >
                {[5, 10, 15, 20, 30, 45, 60].map((n) => (
                  <option key={n} value={n}>
                    {n} minutos
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
        <section>
          <h2>Armazenamento</h2>
          <div className="setting-row">
            <div className="storage-setting">
              <HardDrive size={21} strokeWidth={1.5} />
              <div>
                <strong>Neste navegador</strong>
                <p>
                  Seus documentos, progresso e anotações ficam salvos
                  localmente.
                </p>
              </div>
            </div>
            <span className="status-tag">{usage || "Local"}</span>
          </div>
          <div className="setting-row">
            <div className="storage-setting">
              <Database size={21} strokeWidth={1.5} />
              <div>
                <strong>Supabase + Prisma</strong>
                <p>
                  {config?.database
                    ? "Biblioteca sincronizada com sua conta."
                    : "Conexão remota ainda não configurada."}
                </p>
              </div>
            </div>
            <span className="status-tag muted">
              {config?.database ? "Configurado" : "Não conectado"}
            </span>
          </div>
          <div className="setting-row">
            <div className="storage-setting">
              <Cloud size={21} strokeWidth={1.5} />
              <div>
                <strong>Cloudflare R2</strong>
                <p>Seus arquivos originais em armazenamento privado.</p>
              </div>
            </div>
            <span className="status-tag muted">
              {config?.storage ? "Configurado" : "Não conectado"}
            </span>
          </div>
        </section>
        <section>
          <h2>Uma cópia das suas ideias</h2>
          <div className="setting-row">
            <div>
              <p>
                Exporte metadados, coleções, destaques e anotações em JSON. Os
                arquivos originais são baixados pelo leitor e não estão
                incluídos neste backup.
              </p>
            </div>
            <button className="button secondary" onClick={exportData}>
              <Download size={16} />
              Exportar dados
            </button>
          </div>
        </section>
        <div className="settings-about">
          <BookOpen size={23} strokeWidth={1.4} />
          <strong>Personal Reader</strong>
          <span>Versão 0.1 · Feito para o seu tempo de leitura.</span>
        </div>
      </div>
    </>
  );
}
export function StatisticsView() {
  const { documents, annotations, readingSeconds, preferences } = useLibrary();
  const finished = documents.filter((d) => d.status === "finished" && !d.demo);
  const minutes = Math.floor(readingSeconds / 60);
  const percent = Math.min(
    100,
    Math.round((minutes / preferences.dailyGoal) * 100),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Uma página de cada vez</h1>
          <p>O tempo dedicado à leitura também conta uma história.</p>
        </div>
      </div>
      <section className="reading-stats">
        <div className="reading-time">
          <BookOpen size={36} strokeWidth={1.2} />
          <h2>Seu tempo entre páginas</h2>
          <strong>
            {minutes}
            <small>minutos</small>
          </strong>
          <p>de leitura registrada neste navegador</p>
          <div className="goal-progress">
            <span style={{ width: `${percent}%` }} />
          </div>
          <span>
            {percent}% da meta de {preferences.dailyGoal} minutos · tempo
            acumulado
          </span>
        </div>
        <div className="statistics-details">
          <div>
            <CheckCheck size={21} />
            <strong>{finished.length}</strong>
            <span>Documentos concluídos</span>
          </div>
          <div>
            <BookOpen size={21} />
            <strong>
              {documents.filter((d) => d.status === "reading").length}
            </strong>
            <span>Leituras em andamento</span>
          </div>
          <div>
            <Clock size={21} />
            <strong>{annotations.length}</strong>
            <span>Ideias e marcações guardadas</span>
          </div>
        </div>
      </section>
      <p className="stats-footnote">
        O tempo é contado enquanto o leitor está aberto e a aba está visível.
        Amostras não entram na contagem de documentos concluídos.
      </p>
    </>
  );
}
