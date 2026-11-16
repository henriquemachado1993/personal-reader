"use client";
import { ActionIcon, Tooltip, Modal as MantineModal } from "@mantine/core";
import { Dropdown } from "./ui/dropdown";
import { X, BookOpen, MoreHorizontal } from "lucide-react";
import type { ReaderDocument } from "@/shared/types";
export function IconButton({
  label,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <Tooltip
      label={label}
      withArrow
      events={{ hover: true, focus: true, touch: false }}
    >
      <ActionIcon
        type="button"
        aria-label={label}
        className={`icon-button ${className}`}
        {...props}
      >
        {children}
      </ActionIcon>
    </Tooltip>
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
        <img
          src={book.cover}
          alt={`Capa de ${book.title}`}
          draggable={false}
          loading="lazy"
          decoding="async"
        />
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
  return (
    <MantineModal
      opened
      onClose={onClose}
      title={title}
      size={wide ? 700 : 560}
      classNames={{
        content: "reader-modal",
        title: "reader-modal-title",
        body: "reader-modal-body",
      }}
      closeButtonProps={{ "aria-label": "Fechar" }}
    >
      {children}
    </MantineModal>
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
  return (
    <Dropdown
      label="Opções do livro"
      icon={<MoreHorizontal size={20} />}
      className="book-menu"
      triggerClassName="icon-button"
    >
      {children}
    </Dropdown>
  );
}
