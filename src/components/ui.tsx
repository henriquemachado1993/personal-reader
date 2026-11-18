"use client";
import { ActionIcon, Tooltip, Modal as MantineModal } from "@mantine/core";
import { Dropdown } from "./ui/dropdown";
import { useReducedMotion } from "@mantine/hooks";
import { modalTransition } from "./ui/modal-motion";
import { X, BookOpen, MoreHorizontal } from "lucide-react";
import { LibraryAssetImage } from "@/modules/library/use-library-asset";
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
        <LibraryAssetImage
          reference={book.cover}
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
  opened,
  title,
  children,
  onClose,
  wide = false,
  onExitTransitionEnd,
}: {
  opened: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  onExitTransitionEnd?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <MantineModal
      opened={opened}
      onClose={onClose}
      title={title}
      size={wide ? 700 : 560}
      classNames={{
        content: "reader-modal",
        title: "reader-modal-title",
        body: "reader-modal-body",
      }}
      closeButtonProps={{ "aria-label": "Fechar" }}
      onExitTransitionEnd={onExitTransitionEnd}
      transitionProps={{
        transition: modalTransition,
        duration: reducedMotion ? 0 : 200,
        exitDuration: reducedMotion ? 0 : 140,
        timingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      overlayProps={{
        transitionProps: {
          duration: reducedMotion ? 0 : 160,
          // Keep the page shielded until dialog content has left, so rapid actions cannot hit a closing form.
          exitDuration: reducedMotion ? 0 : 160,
        },
      }}
    >
      <fieldset
        disabled={!opened}
        inert={!opened}
        aria-hidden={!opened}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        {children}
      </fieldset>
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
