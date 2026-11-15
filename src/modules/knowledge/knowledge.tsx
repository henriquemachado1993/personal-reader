"use client";
import {
  Button,
  TextField,
  SelectField,
  TextArea,
} from "@/components/ui/controls";
import { useState } from "react";
import Link from "next/link";
import {
  Highlighter,
  StickyNote,
  ScanLine,
  ArrowUpRight,
  Download,
  Plus,
  Trash2,
  Shapes,
} from "lucide-react";
import { useLibrary } from "@/modules/library/store";
import { Cover, EmptyState, IconButton, Modal } from "@/components/ui";
import { downloadBlob } from "@/modules/reader/export";
export function KnowledgeView({
  kind,
  search,
}: {
  kind: string;
  search: string;
}) {
  const state = useLibrary();
  const [filter, setFilter] = useState("all");
  const [document, setDocument] = useState("all");
  const [color, setColor] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [untilDate, setUntilDate] = useState("");
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [noteDoc, setNoteDoc] = useState(state.documents[0]?.id ?? "");
  const forcedKind = (
    { highlights: "highlight", notes: "note", clippings: "clipping" } as Record<
      string,
      string
    >
  )[kind];
  const visible = state.annotations
    .filter(
      (a) =>
        ["highlight", "note", "clipping"].includes(a.kind) &&
        (!forcedKind || a.kind === forcedKind) &&
        (filter === "all" || a.kind === filter) &&
        (document === "all" || a.documentId === document) &&
        (color === "all" || a.color === color) &&
        (!fromDate || a.createdAt.slice(0, 10) >= fromDate) &&
        (!untilDate || a.createdAt.slice(0, 10) <= untilDate) &&
        `${a.text} ${a.quote ?? ""} ${state.documents.find((d) => d.id === a.documentId)?.title ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const title =
    (
      {
        highlights: "Destaques",
        notes: "Anotações",
        clippings: "Capturas",
      } as Record<string, string>
    )[kind] ?? "Seu conhecimento, conectado";
  const exportNotes = () => {
    const markdown = `# Minhas leituras e ideias\n\n${visible.map((a) => `## ${state.documents.find((d) => d.id === a.documentId)?.title ?? "Documento"} — página ${a.page + 1}\n\n${a.quote ? `> ${a.quote}\n\n` : ""}${a.text}\n\n${a.image ? `![Captura](${a.image})\n\n` : ""}`).join("---\n\n")}`;
    downloadBlob(
      new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
      "minhas-anotacoes.md",
    );
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          <p>O que fica com você depois da última página.</p>
        </div>
        <div className="heading-actions">
          <Button
            className="button secondary"
            disabled={!visible.length}
            onClick={exportNotes}
          >
            <Download size={16} />
            Exportar
          </Button>
          <Button
            className="button primary"
            disabled={!state.documents.length}
            onClick={() => setWriting(true)}
          >
            <Plus size={16} />
            Nova anotação
          </Button>
        </div>
      </div>
      <div className="knowledge-toolbar">
        <label>
          De{" "}
          <TextField
            type="date"
            className="input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label>
          Até{" "}
          <TextField
            type="date"
            className="input"
            value={untilDate}
            min={fromDate || undefined}
            onChange={(e) => setUntilDate(e.target.value)}
          />
        </label>
        {!forcedKind && (
          <div
            className="format-filters"
            role="group"
            aria-label="Tipo de anotação"
          >
            <Button
              className={filter === "all" ? "active" : ""}
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              Tudo
              <span>
                {
                  state.annotations.filter((a) =>
                    ["note", "highlight", "clipping"].includes(a.kind),
                  ).length
                }
              </span>
            </Button>
            {[
              { id: "highlight", name: "Destaques", icon: Highlighter },
              { id: "note", name: "Anotações", icon: StickyNote },
              { id: "clipping", name: "Capturas", icon: ScanLine },
            ].map(({ id, name, icon: Icon }) => (
              <Button
                key={id}
                className={filter === id ? "active" : ""}
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                <Icon size={15} />
                {name}
              </Button>
            ))}
          </div>
        )}
        <div className="knowledge-selects">
          <label className="sr-only" htmlFor="document-filter">
            Filtrar por documento
          </label>
          <SelectField
            id="document-filter"
            className="input"
            value={document}
            onChange={(e) => setDocument(e.target.value)}
          >
            <option value="all">Todos os documentos</option>
            {state.documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </SelectField>
          <label className="sr-only" htmlFor="color-filter">
            Filtrar por cor
          </label>
          <SelectField
            id="color-filter"
            className="input"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          >
            <option value="all">Todas as cores</option>
            <option value="#e8bb45">Amarelo</option>
            <option value="#db7f88">Rosa</option>
            <option value="#6a997d">Verde</option>
            <option value="#7f9fc4">Azul</option>
            <option value="#3e3830">Grafite</option>
          </SelectField>
        </div>
      </div>
      {visible.length ? (
        <div className="knowledge-list">
          {visible.map((a) => {
            const book = state.documents.find((d) => d.id === a.documentId);
            if (!book) return null;
            const Icon =
              a.kind === "highlight"
                ? Highlighter
                : a.kind === "clipping"
                  ? ScanLine
                  : StickyNote;
            return (
              <article className="knowledge-entry" key={a.id}>
                <div className="entry-content">
                  <div className="entry-meta">
                    <span>
                      <Icon size={15} style={{ color: a.color }} />
                      {a.kind === "highlight"
                        ? "Destaque"
                        : a.kind === "clipping"
                          ? "Captura"
                          : "Anotação"}
                    </span>
                    <time dateTime={a.createdAt}>
                      {new Date(a.createdAt).toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </time>
                  </div>
                  {a.quote && (
                    <blockquote
                      style={{
                        background:
                          a.kind === "highlight" ? `${a.color}24` : undefined,
                      }}
                    >
                      {a.quote}
                    </blockquote>
                  )}
                  {a.text !== a.quote && <p>{a.text}</p>}
                  {a.image && (
                    <img
                      className="clipping-image"
                      loading="lazy"
                      decoding="async"
                      src={a.image}
                      alt={a.text}
                    />
                  )}
                  <Link
                    className="entry-source"
                    href={`/reader/${book.id}?page=${a.page + 1}&annotation=${a.id}`}
                  >
                    <Cover book={book} />
                    <span>
                      <strong>{book.title}</strong>
                      <small>
                        {book.author} · Página {a.page + 1}
                      </small>
                    </span>
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
                <IconButton
                  label="Remover anotação"
                  onClick={() => state.removeAnnotation(a.id)}
                >
                  <Trash2 size={16} />
                </IconButton>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Shapes size={38} strokeWidth={1.15} />}
          title={
            search
              ? "Nenhuma ideia com esse termo"
              : "Uma boa ideia merece ficar"
          }
          action={
            <Link className="button secondary" href="/library">
              <BookIcon />
              Explorar minha biblioteca
            </Link>
          }
        >
          {search
            ? "Tente outra palavra ou ajuste os filtros."
            : "Destaque um trecho, anote um pensamento ou capture parte de um PDF durante a leitura. Tudo encontra um lugar aqui, com o caminho de volta ao livro."}
        </EmptyState>
      )}
      {writing && (
        <Modal title="Uma ideia para guardar" onClose={() => setWriting(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim() || !noteDoc) return;
              const book = state.documents.find((d) => d.id === noteDoc)!;
              const now = new Date().toISOString();
              state.addAnnotation({
                id: crypto.randomUUID(),
                documentId: noteDoc,
                kind: "note",
                page: book.page,
                location:
                  book.location ??
                  (book.format === "PDF"
                    ? { type: "PDF", pageIndex: book.page }
                    : book.format === "EPUB"
                      ? { type: "EPUB", cfi: "", href: "" }
                      : {
                          type: book.format,
                          blockIndex: book.page,
                          offset: 0,
                        }),
                text: text.trim(),
                color: "#e8bb45",
                createdAt: now,
                updatedAt: now,
              });
              setWriting(false);
              setText("");
              state.notify("Ideia salva nas suas anotações.");
            }}
          >
            <label className="field-label">
              Relacionada a
              <SelectField
                className="input"
                value={noteDoc}
                onChange={(e) => setNoteDoc(e.target.value)}
              >
                {state.documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </SelectField>
            </label>
            <label className="field-label">
              Sua anotação
              <TextArea
                className="input note-textarea"
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escreva uma ideia, uma conexão, uma pergunta…"
                required
                maxLength={10000}
              />
            </label>
            <div className="dialog-actions">
              <Button
                type="button"
                className="button secondary"
                onClick={() => setWriting(false)}
              >
                Cancelar
              </Button>
              <Button className="button primary" disabled={!text.trim()}>
                Salvar anotação
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function BookIcon() {
  return <ArrowUpRight size={16} />;
}
