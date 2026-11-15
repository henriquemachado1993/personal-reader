"use client";
import { useEffect, useRef, useId } from "react";
import { X, BookOpen, MoreHorizontal } from "lucide-react";
import type { ReaderDocument } from "@/shared/types";
export function IconButton({
  label,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-button ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function Cover({
  book,
  className = "",
}: {
  book: ReaderDocument;
  className?: string;
}) {
  return (
    <div
      className={`book-cover ${className}`}
      style={{ backgroundColor: book.color }}
    >
      {book.cover ? (
        <img src={book.cover} alt={`Capa de ${book.title}`} draggable={false} />
      ) : (
        <div className="generated-cover">
          <span>{book.author}</span>
          <strong>{book.title}</strong>
          <BookOpen size={26} strokeWidth={1} />
          <small>{book.format}</small>
        </div>
      )}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      aria-labelledby={titleId}
      ref={ref}
      className={`dialog ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <IconButton label="Fechar" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon ?? <BookOpen size={32} strokeWidth={1.25} />}
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function BookMenu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node))
        ref.current?.removeAttribute("open");
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  return (
    <details ref={ref} className="book-menu">
      <summary aria-label="Opções do livro" title="Opções do livro">
        <MoreHorizontal size={20} />
      </summary>
      <div
        className="menu-popover"
        onClick={() => ref.current?.removeAttribute("open")}
      >
        {children}
      </div>
    </details>
  );
}
