"use client";

import { useId, useRef, useState } from "react";
import { FolderClosed, Plus } from "lucide-react";
import { Modal } from "@/components/ui";
import { Button, TextField } from "@/components/ui/controls";
import type { ReaderDocument } from "@/shared/types";
import { useLibrary } from "./store";
import "./collection-assignment.css";

export function CollectionAssignment({
  book,
  opened,
  onClose,
}: {
  book: ReaderDocument;
  opened: boolean;
  onClose: () => void;
}) {
  const { collections, addCollection, updateDocument } = useLibrary();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const createButton = useRef<HTMLButtonElement>(null);
  const formId = useId();
  const nameId = useId();
  const finishCreating = () => {
    setCreating(false);
    setName("");
    createButton.current?.focus({ preventScroll: true });
  };
  const close = () => {
    setCreating(false);
    setName("");
    onClose();
  };

  return (
    <Modal opened={opened} title="Organizar em coleções" onClose={close}>
      <div className="collection-assignment">
        <p className="dialog-description">
          Um livro pode fazer parte de várias coleções.
        </p>
        <div className="assign-collections">
          {collections.map((collection) => (
            <label key={collection.id}>
              <FolderClosed size={18} style={{ color: collection.color }} />
              <span>{collection.name}</span>
              <TextField
                type="checkbox"
                checked={book.collections.includes(collection.id)}
                onChange={(event) =>
                  updateDocument(book.id, {
                    collections: event.target.checked
                      ? [...book.collections, collection.id]
                      : book.collections.filter((id) => id !== collection.id),
                  })
                }
              />
            </label>
          ))}
        </div>
        {!collections.length && (
          <p className="dialog-description">
            Você ainda não tem coleções. Crie a primeira abaixo.
          </p>
        )}
        <Button
          ref={createButton}
          type="button"
          className="button secondary collection-create-toggle"
          aria-expanded={creating}
          aria-controls={formId}
          onClick={() => {
            if (creating) finishCreating();
            else setCreating(true);
          }}
        >
          <Plus size={16} />
          Nova coleção
        </Button>
        {creating && (
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              const collectionName = name.trim();
              if (!collectionName) return;
              const collectionId = crypto.randomUUID();
              addCollection({
                id: collectionId,
                name: collectionName,
                color: "#9a8061",
              });
              updateDocument(book.id, {
                collections: [...book.collections, collectionId],
              });
              finishCreating();
            }}
          >
            <label className="field-label" htmlFor={nameId}>
              Nome da coleção
              <TextField
                id={nameId}
                className="input"
                placeholder="Ex.: Leituras de fim de semana"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
                maxLength={70}
                required
              />
            </label>
            <div className="dialog-actions">
              <Button
                type="button"
                className="button secondary"
                onClick={finishCreating}
              >
                Cancelar
              </Button>
              <Button className="button primary" disabled={!name.trim()}>
                Criar e adicionar
              </Button>
            </div>
          </form>
        )}
        {!creating && (
          <div className="dialog-actions">
            <Button type="button" className="button primary" onClick={close}>
              Concluir
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
