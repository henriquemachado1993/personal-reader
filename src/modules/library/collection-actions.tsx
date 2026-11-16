"use client";
import { useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { IconButton, Modal } from "@/components/ui";
import { Button, TextField } from "@/components/ui/controls";
import { useLibrary } from "./store";
import type { Collection } from "@/shared/types";

export function CollectionActions({ collection }: { collection: Collection }) {
  const pendingRemoval = useRef(false);
  const [action, setAction] = useState<"edit" | "delete">("edit");
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState(collection.name);
  return (
    <>
      <div className="collection-actions">
        <IconButton
          label={`Editar ${collection.name}`}
          onClick={() => {
            setName(collection.name);
            setAction("edit");
            setOpened(true);
          }}
        >
          <Pencil size={17} />
        </IconButton>
        <IconButton
          label={`Excluir ${collection.name}`}
          onClick={() => {
            setAction("delete");
            setOpened(true);
          }}
        >
          <Trash2 size={17} />
        </IconButton>
      </div>
      <Modal
        opened={opened}
        onExitTransitionEnd={() => {
          if (pendingRemoval.current) {
            pendingRemoval.current = false;
            useLibrary.getState().deleteCollection(collection.id);
          }
        }}
        title={action === "edit" ? "Editar coleção" : "Excluir coleção?"}
        onClose={() => setOpened(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (action === "edit")
              useLibrary
                .getState()
                .updateCollection(collection.id, name.trim());
            else pendingRemoval.current = true;
            setOpened(false);
          }}
        >
          {action === "edit" ? (
            <label className="field-label">
              Nome da coleção
              <TextField
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={70}
              />
            </label>
          ) : (
            <p className="dialog-description">
              A coleção “{collection.name}” será excluída. Seus livros e
              anotações continuarão na biblioteca.
            </p>
          )}
          <div className="dialog-actions">
            <Button
              type="button"
              className="button secondary"
              onClick={() => setOpened(false)}
            >
              Cancelar
            </Button>
            <Button
              className="button primary"
              disabled={action === "edit" && !name.trim()}
            >
              {action === "edit" ? "Salvar alterações" : "Excluir coleção"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
