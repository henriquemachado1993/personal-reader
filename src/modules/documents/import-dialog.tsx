"use client";
import { Button, TextField } from "@/components/ui/controls";
import { useRef, useState } from "react";
import { Upload, Check, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui";
import { importDocument } from "./import";
import { useLibrary } from "@/modules/library/store";
export function ImportDialog({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const importing = useRef(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<{ name: string; error?: string }[]>(
    [],
  );
  const { addDocuments, notify } = useLibrary();
  const add = async (files: FileList | File[]) => {
    if (importing.current || !files.length) return;
    importing.current = true;
    setBusy(true);
    const next: typeof results = [];
    for (const [index, file] of Array.from(files).entries()) {
      setProgress(`Importando ${index + 1} de ${files.length}: ${file.name}`);
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
    importing.current = false;
    setProgress("");
    const count = next.filter((r) => !r.error).length;
    if (count)
      notify(
        `${count} ${count === 1 ? "documento adicionado" : "documentos adicionados"} à sua biblioteca.`,
      );
  };
  return (
    <Modal
      opened={opened}
      onExitTransitionEnd={() => {
        setResults([]);
        setDragging(false);
      }}
      title="Importar arquivos"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="import-flow" aria-busy={busy}>
        <TextField
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
        <Button
          className={`upload-zone ${dragging ? "dragging" : ""}`}
          aria-label="Selecionar arquivos"
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
            {busy ? "Preparando seus documentos…" : "Selecionar arquivos"}
          </strong>
          <span className="import-drop-hint">ou arraste e solte aqui</span>
          <small>PDF, EPUB, DOCX ou TXT · até 100 MB por arquivo</small>
        </Button>
        {busy && (
          <p className="import-progress" role="status">
            {progress}
          </p>
        )}
        {results.length > 0 && (
          <ul className="import-results" aria-live="polite">
            {results.map((r, i) => (
              <li key={i} className={r.error ? "import-error" : ""}>
                {r.error ? <AlertCircle size={17} /> : <Check size={17} />}
                <div>
                  <strong>{r.name}</strong>
                  <span>{r.error ?? "Adicionado à biblioteca"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="import-privacy">
          <p>Seus arquivos originais são preservados.</p>
        </div>
        {results.length > 0 && (
          <div className="dialog-actions">
            <Button
              className="button primary"
              disabled={busy}
              onClick={onClose}
            >
              Concluir
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
