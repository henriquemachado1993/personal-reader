"use client";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, Download, ChevronDown } from "lucide-react";
import { Button, SelectField } from "@/components/ui/controls";
import { useLibrary } from "@/modules/library/store";
import { CacheSettings } from "./cache-settings";
import { InvitationSettings } from "./invitation-settings";
import { SyncSettings } from "./sync-settings";
import { exportLibraryBackup } from "./library-backup";
import "./settings-view.css";
import "./workspace-page.css";

export function SettingsView() {
  const { preferences, setPreferences } = useLibrary();
  const [usage, setUsage] = useState("");
  const [config, setConfig] = useState<{
    database: boolean;
    storage: boolean;
  } | null>(null);
  const [configError, setConfigError] = useState(false);
  useEffect(() => {
    let active = true;
    void navigator.storage
      ?.estimate()
      .then((s) => {
        if (active) setUsage(`${((s.usage ?? 0) / 1024 / 1024).toFixed(1)} MB`);
      })
      .catch(() => {});
    void fetch("/api/status")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((result) => {
        if (active) setConfig(result);
      })
      .catch(() => {
        if (active) setConfigError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const configured = (value: boolean | undefined) =>
    configError
      ? "Não foi possível verificar"
      : !config
        ? "Verificando…"
        : value
          ? "Configurado"
          : "Não configurado";
  return (
    <div className="workspace-page settings-page">
      <div className="page-heading settings-heading">
        <div>
          <h1>Configurações</h1>
          <p>Seu jeito de ler e cuidar da biblioteca.</p>
        </div>
      </div>
      <div className="settings-refined">
        <section
          className="preferences-section"
          aria-labelledby="reading-settings-title"
        >
          <h2 id="reading-settings-title">Leitura</h2>
          <div className="preference-row">
            <div>
              <h3>Aparência</h3>
              <p>O tema da biblioteca. A cor da página é ajustada no leitor.</p>
            </div>
            <div
              className="preference-themes"
              role="group"
              aria-label="Tema da biblioteca"
            >
              {(
                [
                  { id: "light", label: "Claro", icon: Sun },
                  { id: "dark", label: "Escuro", icon: Moon },
                  { id: "system", label: "Sistema", icon: Monitor },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  className={preferences.theme === id ? "active" : ""}
                  aria-pressed={preferences.theme === id}
                  onClick={() => setPreferences({ theme: id })}
                >
                  <Icon size={18} />
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div className="preference-row">
            <div>
              <h3>Meta diária</h3>
              <p>Quanto tempo você quer reservar para ler.</p>
            </div>
            <SelectField
              aria-label="Meta diária em minutos"
              value={preferences.dailyGoal}
              onChange={(e) =>
                setPreferences({ dailyGoal: Number(e.target.value) })
              }
            >
              {[5, 10, 15, 20, 30, 45, 60].map((n) => (
                <option key={n} value={n}>
                  {n} minutos
                </option>
              ))}
            </SelectField>
          </div>
        </section>
        <SyncSettings />
        <InvitationSettings />
        <section
          className="preferences-section"
          aria-labelledby="data-settings-title"
        >
          <h2 id="data-settings-title">Dados da biblioteca</h2>
          <div className="preference-row">
            <div>
              <h3>Cópia de segurança</h3>
              <p>
                Exporte sua biblioteca, progresso e anotações em JSON. Os
                arquivos originais não estão incluídos.
              </p>
            </div>
            <Button className="button secondary" onClick={exportLibraryBackup}>
              <Download size={16} />
              Exportar backup
            </Button>
          </div>
          <CacheSettings
            onCleared={() => {
              void navigator.storage
                ?.estimate()
                .then((estimate) => {
                  setUsage(
                    `${((estimate.usage ?? 0) / 1024 / 1024).toFixed(1)} MB`,
                  );
                })
                .catch(() => {});
            }}
          />
          <details className="settings-storage">
            <summary>
              Armazenamento
              <ChevronDown size={18} />
            </summary>
            <dl>
              <div>
                <dt>Neste dispositivo</dt>
                <dd>{usage || "Uso não informado"}</dd>
                <p>
                  Documentos abertos e alterações salvas para acesso offline.
                </p>
              </div>
              <div>
                <dt>Biblioteca na conta</dt>
                <dd>{configured(config?.database)}</dd>
                <p>
                  A configuração da conexão não confirma a sincronização.
                  Consulte o estado acima.
                </p>
              </div>
              <div>
                <dt>Arquivos na nuvem</dt>
                <dd>{configured(config?.storage)}</dd>
                <p>Armazenamento privado dos seus arquivos originais.</p>
              </div>
            </dl>
          </details>
        </section>
        <p className="settings-version">
          Le-Books <span>Versão 0.1</span>
        </p>
      </div>
    </div>
  );
}
