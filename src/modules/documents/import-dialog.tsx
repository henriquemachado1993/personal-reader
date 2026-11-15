"use client";
import { useRef, useState } from "react";
import { Upload, FileText, Check, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui";
import { importDocument } from "./import";
import { useLibrary } from "@/modules/library/store";
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ name: string; error?: string }[]>(
    [],
  );
  const { addDocuments, notify } = useLibrary();
  const add = async (files: FileList | File[]) => {
    if (busy) return;
    setBusy(true);
    const next: typeof results = [];
    for (const file of Array.from(files)) {
      try {
        const document = await importDocument(file);
        addDocuments([document]);
        next.push({ name: file.name });
      } catch (e) {
        next.push({
          name: file.name,
          error:
            e instanceof Error
              ? e.message
              : "Não foi possível ler este arquivo.",
        });
      }
    }
    setResults((r) => [...r, ...next]);
    setBusy(false);
    const count = next.filter((r) => !r.error).length;
    if (count)
      notify(
        `${count} ${count === 1 ? "documento adicionado" : "documentos adicionados"} à sua biblioteca.`,
      );
  };
  return (
    <Modal
      title="Novas leituras começam aqui"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="dialog-description">
        Traga seus livros e documentos para a sua biblioteca.
      </p>
      <input
        ref={input}
        type="file"
        accept=".pdf,.epub,.docx,.txt"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void add(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        className={`upload-zone ${dragging ? "dragging" : ""}`}
        disabled={busy}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void add(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
      >
        <span className="upload-icon">
          <Upload size={26} strokeWidth={1.5} />
        </span>
        <strong>
          {busy
            ? "Preparando seus documentos…"
            : "Arraste seus arquivos para cá"}
        </strong>
        <span>ou clique para escolher no computador</span>
        <small>PDF, EPUB, DOCX e TXT · até 100 MB por arquivo</small>
      </button>
      {results.length > 0 && (
        <ul className="import-results" aria-live="polite">
          {results.map((r, i) => (
            <li key={i} className={r.error ? "import-error" : ""}>
              {r.error ? <AlertCircle size={17} /> : <Check size={17} />}
              <div>
                <strong>{r.name}</strong>
                {r.error && <span>{r.error}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="import-privacy">
        <FileText size={16} />
        <span>
          Seus originais são preservados. Nesta versão, os arquivos ficam neste
          navegador.
        </span>
      </div>
      <div className="dialog-actions">
        <button className="button secondary" disabled={busy} onClick={onClose}>
          Concluir
        </button>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <PlusIcon />
          {busy ? "Importando…" : "Selecionar arquivos"}
        </button>
      </div>
    </Modal>
  );
}
function PlusIcon() {
  return <Upload size={16} />;
}
