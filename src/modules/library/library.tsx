"use client";
import { Button, TextField, SelectField } from "@/components/ui/controls";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Grid2X2,
  List,
  ChevronDown,
  BookOpen,
  CheckCheck,
  Bookmark,
  FolderPlus,
  Trash2,
  Pencil,
  SearchX,
  FolderClosed,
} from "lucide-react";
import { useLibrary } from "./store";
import { CollectionActions } from "./collection-actions";
import {
  Cover,
  IconButton,
  BookMenu,
  EmptyState,
  Modal,
} from "@/components/ui";
import type { ReaderDocument, ReadingStatus } from "@/shared/types";

export function LibraryView({
  path,
  search,
  onImport,
}: {
  path: string;
  search: string;
  onImport: () => void;
}) {
  const { documents, collections } = useLibrary();
  const [format, setFormat] = useState("all");
  const [sort, setSort] = useState(path === "/library" ? "author" : "recent");
  const [view, setView] = useState(path === "/library" ? "list" : "grid");
  const isCollection = path.startsWith("/collections/");
  const collection = collections.find((c) => c.id === path.split("/")[2]);
  const status = path.split("/")[2];
  const isHome = path === "/";
  const isLibrary = path === "/library";
  const isHistory = path === "/history";
  if (isCollection && !collection)
    return (
      <EmptyState
        title="Coleção não encontrada"
        action={
          <Link className="button secondary" href="/collections">
            Ver minhas coleções
          </Link>
        }
      >
        Esta coleção pode ter sido removida. Volte à lista para escolher outra.
      </EmptyState>
    );
  const heading = isCollection
    ? (collection?.name ?? "Coleção não encontrada")
    : ({
        reading: "Lendo agora",
        want: "Quero ler",
        finished: "Concluídos",
        recent: "Adicionados recentemente",
      }[status] ??
      (isHistory ? "Histórico" : isHome ? "Início" : "Biblioteca"));
  const reading = documents
    .filter((d) => d.status === "reading")
    .sort((a, b) => (b.lastReadAt ?? "").localeCompare(a.lastReadAt ?? ""))
    .slice(0, 3);
  const visible = documents
    .filter(
      (d) =>
        (!isCollection ||
          d.collections.includes(collection?.id ?? "missing")) &&
        (isHome ||
          isLibrary ||
          isCollection ||
          isHistory ||
          status === "recent" ||
          d.status === status) &&
        (!isHistory || d.lastReadAt) &&
        (format === "all" || d.format === format) &&
        `${d.title} ${d.author}`
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR")),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "pt-BR")
        : sort === "author"
          ? a.author.localeCompare(b.author, "pt-BR")
          : sort === "progress"
            ? b.progress - a.progress
            : (isHistory ? (b.lastReadAt ?? "") : b.addedAt).localeCompare(
                isHistory ? (a.lastReadAt ?? "") : a.addedAt,
              ),
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{heading}</h1>
          {isCollection && <p>{visible.length} documentos</p>}
        </div>
        <Button className="button primary" onClick={onImport}>
          <Plus size={17} />
          Importar arquivos
        </Button>
      </div>
      {isHome && !search && reading.length > 0 && (
        <section
          className="continue-section"
          aria-labelledby="continue-heading"
        >
          <div className="section-heading">
            <h2 id="continue-heading">Continuar</h2>
            <Link href="/library/reading">
              Ver todos
              <ArrowRight size={15} />
            </Link>
          </div>
          <div className="continue-grid">
            {reading.map((book, i) => (
              <Link
                className={`continue-book continue-${i}`}
                key={book.id}
                href={`/reader/${book.id}`}
              >
                <Cover book={book} />
                <div className="continue-info">
                  <h3>{book.title}</h3>
                  <p>{book.author}</p>
                  <span className="continue-progress">
                    {book.format} · {book.progress}%
                    {book.demo ? " · Amostra" : ""}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section
        className={`shelf-section ${isHome ? "books-home-shelf" : ""}`}
        aria-labelledby="shelf-heading"
      >
        <div className="section-heading shelf-heading">
          <div>
            <h2 id="shelf-heading">
              {isHome ? "Quero Ler" : "Todos os livros"}
            </h2>
            <span className="document-count">
              {
                visible.filter((book) => !isHome || book.status === "want")
                  .length
              }{" "}
              documentos
            </span>
          </div>
          <div className="shelf-controls">
            <label className="sort-control">
              <span className="sr-only">Ordenar documentos</span>
              <SelectField
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="recent">Mais recentes</option>
                <option value="title">Título</option>
                <option value="author">Autor</option>
                <option value="progress">Progresso</option>
              </SelectField>
              <ChevronDown size={14} />
            </label>
            <div className="view-toggle" aria-label="Visualização">
              <IconButton
                label="Visualizar em grade"
                aria-pressed={view === "grid"}
                className={view === "grid" ? "selected" : ""}
                onClick={() => setView("grid")}
              >
                <Grid2X2 size={17} />
              </IconButton>
              <IconButton
                label="Visualizar em lista"
                aria-pressed={view === "list"}
                className={view === "list" ? "selected" : ""}
                onClick={() => setView("list")}
              >
                <List size={18} />
              </IconButton>
            </div>
          </div>
        </div>
        {isHome && <p>Próximos livros que você deseja ler.</p>}
        <div
          className="format-filters"
          role="group"
          aria-label="Filtrar por formato"
        >
          {[
            ["all", "Todos"],
            ["PDF", "PDFs"],
            ["EPUB", "EPUBs"],
            ["DOCX", "Documentos"],
            ["TXT", "Textos"],
          ].map(([value, label]) => (
            <Button
              key={value}
              onClick={() => setFormat(value)}
              className={format === value ? "active" : ""}
              aria-pressed={format === value}
            >
              {label}
              {value === "all" && <span>{documents.length}</span>}
            </Button>
          ))}
        </div>
        {visible.length ? (
          <div className={`book-grid ${view === "list" ? "list-view" : ""}`}>
            {visible
              .filter((book) => !isHome || book.status === "want")
              .map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
          </div>
        ) : (
          <EmptyState
            icon={<SearchX size={32} strokeWidth={1.25} />}
            title={
              search
                ? "Vamos tentar outra busca?"
                : "Sua próxima leitura pode estar aqui"
            }
            action={
              !search && (
                <Button className="button primary" onClick={onImport}>
                  <Plus size={16} />
                  Importar um documento
                </Button>
              )
            }
          >
            {search
              ? `Não encontramos documentos para “${search}”. Tente o título ou o nome do autor.`
              : "Importe um documento ou escolha outro filtro para ver seus livros."}
          </EmptyState>
        )}
      </section>
      {isHome && !search && (
        <section className="shelf-section home-secondary-shelf">
          <div className="section-heading">
            <h2>Adicionados recentemente</h2>
            <Link href="/library">
              Ver todos
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="book-grid">
            {documents.slice(0, 7).map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
function BookCard({ book }: { book: ReaderDocument }) {
  const { updateDocument, deleteDocument, collections, notify } = useLibrary();
  const [confirm, setConfirm] = useState(false);
  const [rename, setRename] = useState(false);
  const [title, setTitle] = useState(book.title);
  const [assign, setAssign] = useState(false);
  const changeStatus = (status: ReadingStatus) => {
    updateDocument(book.id, {
      status,
      ...(status === "finished" ? { progress: 100 } : {}),
    });
    notify(
      status === "finished"
        ? "Mais uma leitura concluída."
        : "Estante atualizada.",
    );
  };
  return (
    <article className="book-card">
      <Link href={`/reader/${book.id}`} className="book-cover-link">
        <Cover book={book} />
        {book.status === "finished" && (
          <span className="finished-badge" aria-label="Concluído">
            <CheckCheck size={14} />
          </span>
        )}
      </Link>
      <div className="book-details">
        <Link href={`/reader/${book.id}`} className="book-title">
          {book.title}
        </Link>
        <p>{book.author}</p>
        <div className="book-meta">
          <span>
            {book.format}
            <span className="meta-dot">·</span>
            {book.progress > 0
              ? `${book.progress}% lido`
              : book.demo
                ? "Amostra"
                : "Novo"}
          </span>
          <BookMenu>
            <Link href={`/reader/${book.id}`}>
              <BookOpen size={15} />
              Abrir livro
            </Link>
            <Button onClick={() => changeStatus("want")}>
              <Bookmark size={15} />
              Quero ler
            </Button>
            <Button onClick={() => changeStatus("finished")}>
              <CheckCheck size={15} />
              Marcar como concluído
            </Button>
            <Button onClick={() => setAssign(true)}>
              <FolderPlus size={15} />
              Adicionar à coleção
            </Button>
            <Button
              onClick={() => {
                setTitle(book.title);
                setRename(true);
              }}
            >
              <Pencil size={15} />
              Renomear
            </Button>
            <Button className="danger" onClick={() => setConfirm(true)}>
              <Trash2 size={15} />
              Remover
            </Button>
          </BookMenu>
        </div>
      </div>
      {confirm && (
        <Modal title="Remover da biblioteca?" onClose={() => setConfirm(false)}>
          <p className="dialog-description">
            “{book.title}”, seus destaques, notas e marcadores serão removidos
            deste navegador.
          </p>
          <div className="dialog-actions">
            <Button
              className="button secondary"
              onClick={() => setConfirm(false)}
            >
              Cancelar
            </Button>
            <Button
              className="button danger-button"
              onClick={() => {
                deleteDocument(book.id);
                setConfirm(false);
                notify("Documento removido da biblioteca.");
              }}
            >
              Remover documento
            </Button>
          </div>
        </Modal>
      )}
      {rename && (
        <Modal title="Renomear documento" onClose={() => setRename(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) {
                updateDocument(book.id, { title: title.trim() });
                setRename(false);
              }
            }}
          >
            <label className="field-label">
              Título
              <TextField
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                maxLength={180}
                required
              />
            </label>
            <div className="dialog-actions">
              <Button
                type="button"
                className="button secondary"
                onClick={() => setRename(false)}
              >
                Cancelar
              </Button>
              <Button className="button primary" disabled={!title.trim()}>
                Salvar título
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {assign && (
        <Modal title="Organizar em coleções" onClose={() => setAssign(false)}>
          <p className="dialog-description">
            Um livro pode fazer parte de várias coleções.
          </p>
          <div className="assign-collections">
            {collections.map((c) => (
              <label key={c.id}>
                <FolderClosed size={18} style={{ color: c.color }} />
                <span>{c.name}</span>
                <TextField
                  type="checkbox"
                  checked={book.collections.includes(c.id)}
                  onChange={(e) =>
                    updateDocument(book.id, {
                      collections: e.target.checked
                        ? [...book.collections, c.id]
                        : book.collections.filter((id) => id !== c.id),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="dialog-actions">
            <Button className="button primary" onClick={() => setAssign(false)}>
              Concluir
            </Button>
          </div>
        </Modal>
      )}
    </article>
  );
}
export function CollectionsView({ search }: { search: string }) {
  const { collections, documents, addCollection } = useLibrary();
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Coleções</h1>
          <p>Um lugar para cada interesse. Uma nova conexão entre livros.</p>
        </div>
        <Button className="button primary" onClick={() => setAdding(true)}>
          <Plus size={17} />
          Nova coleção
        </Button>
      </div>
      {adding && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) {
              addCollection({
                id: crypto.randomUUID(),
                name: name.trim(),
                color: "#9a8061",
              });
              setName("");
              setAdding(false);
            }
          }}
        >
          <label htmlFor="collection-name">Nome da coleção</label>
          <TextField
            id="collection-name"
            className="input"
            placeholder="Ex.: Leituras de fim de semana"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={70}
            required
          />
          <Button className="button primary" disabled={!name.trim()}>
            Criar coleção
          </Button>
          <Button
            type="button"
            className="button secondary"
            onClick={() => setAdding(false)}
          >
            Cancelar
          </Button>
        </form>
      )}
      <div className="collections-grid">
        {collections
          .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
          .map((c) => {
            const books = documents.filter((d) => d.collections.includes(c.id));
            return (
              <article className="collection-with-actions" key={c.id}>
                <Link className="collection-item" href={`/collections/${c.id}`}>
                  <div
                    className="collection-preview"
                    style={{ background: `${c.color}22` }}
                  >
                    {books.slice(0, 3).map((b) => (
                      <Cover book={b} key={b.id} />
                    ))}
                    {!books.length && (
                      <FolderClosed
                        size={40}
                        strokeWidth={1}
                        style={{ color: c.color }}
                      />
                    )}
                  </div>
                  <div>
                    <h2>{c.name}</h2>
                    <span>{books.length} documentos</span>
                    <ArrowUpRight size={20} />
                  </div>
                </Link>
                <CollectionActions collection={c} />
              </article>
            );
          })}
      </div>
    </>
  );
}
