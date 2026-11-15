"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BookOpen,
  Bookmark,
  CheckCheck,
  FolderClosed,
  Highlighter,
  StickyNote,
  ScanLine,
  Settings,
  Search,
  Plus,
  Moon,
  Sun,
  X,
  ChartNoAxesColumnIncreasing,
  Clock3,
  List,
  MoreHorizontal,
  LogOut,
} from "lucide-react";
import { useLibrary } from "@/modules/library/store";
import { LibraryView, CollectionsView } from "@/modules/library/library";
import { KnowledgeView } from "@/modules/knowledge/knowledge";
import { SettingsView, StatisticsView } from "@/modules/settings/settings";
import { ImportDialog } from "@/modules/documents/import-dialog";
import { IconButton } from "@/components/ui";

export function useInitialize() {
  const theme = useLibrary((s) => s.preferences.theme);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);
}
export function Workspace() {
  useInitialize();
  const pathname = usePathname();
  const state = useLibrary();
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const section = pathname.split("/")[1] || "library";
  const knowledgeActive = [
    "knowledge",
    "notes",
    "highlights",
    "clippings",
  ].includes(section);
  useEffect(() => {
    setSearch("");
    headerRef.current
      ?.querySelectorAll("details[open]")
      .forEach((d) => d.removeAttribute("open"));
  }, [pathname]);
  useEffect(() => {
    if (!state.notice) return;
    const timer = setTimeout(state.dismissNotice, 5500);
    return () => clearTimeout(timer);
  }, [state.notice, state.dismissNotice]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 0);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearch("");
        headerRef.current
          ?.querySelectorAll("details[open]")
          .forEach((d) => d.removeAttribute("open"));
      }
    };
    const outside = (event: MouseEvent) => {
      headerRef.current?.querySelectorAll("details[open]").forEach((d) => {
        if (!d.contains(event.target as Node)) d.removeAttribute("open");
      });
    };
    document.addEventListener("keydown", listener);
    document.addEventListener("click", outside);
    return () => {
      document.removeEventListener("keydown", listener);
      document.removeEventListener("click", outside);
    };
  }, []);
  return (
    <div className="books-app">
      <a href="#main" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="books-header" ref={headerRef}>
        <Link
          href="/"
          className="books-wordmark"
          aria-label="Personal Reader — Início"
        >
          <BookOpen size={23} strokeWidth={1.5} />
          <span>Personal Reader</span>
        </Link>
        <nav className="floating-navigation" aria-label="Navegação principal">
          <Link
            href="/"
            className={pathname === "/" ? "active" : ""}
            aria-current={pathname === "/" ? "page" : undefined}
          >
            Início
          </Link>
          <Link
            href="/library"
            className={
              pathname.startsWith("/library") || section === "collections"
                ? "active"
                : ""
            }
            aria-current={pathname.startsWith("/library") ? "page" : undefined}
          >
            Biblioteca
          </Link>
          <Link
            href="/knowledge"
            className={knowledgeActive ? "active" : ""}
            aria-current={knowledgeActive ? "page" : undefined}
          >
            Conhecimento
          </Link>
          <IconButton
            label="Buscar na biblioteca"
            onClick={() => {
              setSearchOpen(!searchOpen);
              setTimeout(() => searchRef.current?.focus(), 0);
            }}
            aria-pressed={searchOpen}
          >
            <Search size={23} strokeWidth={1.8} />
          </IconButton>
        </nav>
        <div className="books-header-actions">
          <details className="header-dropdown">
            <summary
              className="floating-circle"
              aria-label="Coleções e filtros"
              title="Coleções e filtros"
            >
              <List size={25} strokeWidth={1.6} />
            </summary>
            <div className="header-dropdown-content">
              <h2>Coleções</h2>
              <Link href="/library/want">
                <Bookmark size={21} />
                Quero Ler
                <span>
                  {state.documents.filter((d) => d.status === "want").length}
                </span>
              </Link>
              <Link href="/library/reading">
                <BookOpen size={21} />
                Lendo agora
                <span>
                  {state.documents.filter((d) => d.status === "reading").length}
                </span>
              </Link>
              <Link href="/library/finished">
                <CheckCheck size={21} />
                Concluídos
                <span>
                  {
                    state.documents.filter((d) => d.status === "finished")
                      .length
                  }
                </span>
              </Link>
              <div className="dropdown-rule" />
              {state.collections.map((c) => (
                <Link key={c.id} href={`/collections/${c.id}`}>
                  <FolderClosed size={21} />
                  {c.name}
                  <span>
                    {
                      state.documents.filter((d) =>
                        d.collections.includes(c.id),
                      ).length
                    }
                  </span>
                </Link>
              ))}
              <Link href="/collections">
                <Plus size={21} />
                Gerenciar coleções
              </Link>
            </div>
          </details>
          <details className="header-dropdown">
            <summary
              className="floating-circle"
              aria-label="Mais opções"
              title="Mais opções"
            >
              <MoreHorizontal size={26} />
            </summary>
            <div className="header-dropdown-content">
              <button
                onClick={() => {
                  setImporting(true);
                  headerRef.current
                    ?.querySelectorAll("details[open]")
                    .forEach((d) => d.removeAttribute("open"));
                }}
              >
                <Plus size={20} />
                Importar arquivos
              </button>
              <div className="dropdown-rule" />
              <Link href="/collections">
                <FolderClosed size={20} />
                Coleções
              </Link>
              <Link href="/library/reading">
                <BookOpen size={20} />
                Lendo agora
              </Link>
              <Link href="/library/want">
                <Bookmark size={20} />
                Quero Ler
              </Link>
              <Link href="/library/finished">
                <CheckCheck size={20} />
                Concluídos
              </Link>
              <div className="dropdown-rule" />
              <Link href="/highlights">
                <Highlighter size={20} />
                Destaques
              </Link>
              <Link href="/notes">
                <StickyNote size={20} />
                Anotações
              </Link>
              <Link href="/clippings">
                <ScanLine size={20} />
                Capturas
              </Link>
              <Link href="/statistics">
                <ChartNoAxesColumnIncreasing size={20} />
                Estatísticas
              </Link>
              <Link href="/history">
                <Clock3 size={20} />
                Histórico
              </Link>
              <div className="dropdown-rule" />
              <Link href="/settings">
                <Settings size={20} />
                Configurações
              </Link>
              <button
                onClick={() =>
                  state.setPreferences({
                    theme:
                      state.preferences.theme === "dark" ? "light" : "dark",
                  })
                }
              >
                {state.preferences.theme === "dark" ? (
                  <Sun size={20} />
                ) : (
                  <Moon size={20} />
                )}
                Tema {state.preferences.theme === "dark" ? "claro" : "escuro"}
              </button>
              <button onClick={() => void signOut({ callbackUrl: "/login" })}>
                <LogOut size={20} />
                Sair da biblioteca
              </button>
            </div>
          </details>
        </div>
      </header>
      {searchOpen && (
        <div className="books-search">
          <Search size={21} />
          <input
            ref={searchRef}
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              knowledgeActive
                ? "Buscar nas suas ideias"
                : "Título, autor ou documento"
            }
            aria-label="Buscar"
          />
          <IconButton
            label="Fechar busca"
            onClick={() => {
              setSearchOpen(false);
              setSearch("");
            }}
          >
            <X size={20} />
          </IconButton>
        </div>
      )}
      {state.storageError && (
        <div role="alert" className="error-banner">
          {state.storageError}
        </div>
      )}
      <main id="main" className="books-main">
        {section === "collections" && !pathname.split("/")[2] ? (
          <CollectionsView search={search} />
        ) : knowledgeActive ? (
          <KnowledgeView kind={section} search={search} />
        ) : section === "settings" ? (
          <SettingsView />
        ) : section === "statistics" ? (
          <StatisticsView />
        ) : (
          <LibraryView
            key={pathname}
            path={pathname}
            search={search}
            onImport={() => setImporting(true)}
          />
        )}
      </main>
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      {state.notice && (
        <div role="status" className="toast">
          <CheckCheck size={18} />
          {state.notice}
          <IconButton label="Dispensar mensagem" onClick={state.dismissNotice}>
            <X size={16} />
          </IconButton>
        </div>
      )}
    </div>
  );
}
