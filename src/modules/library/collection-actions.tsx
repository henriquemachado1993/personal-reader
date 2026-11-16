"use client";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { IconButton, Modal } from "@/components/ui";
import { Button, TextField } from "@/components/ui/controls";
import { useLibrary } from "./store";
import type { Collection } from "@/shared/types";

export function CollectionActions({ collection }: { collection: Collection }) {
  const [action, setAction] = useState<"edit" | "delete" | null>(null);
  const [name, setName] = useState(collection.name);
  return (
    <>
      <div className="collection-actions">
        <IconButton
          label={`Editar ${collection.name}`}
          onClick={() => {
            setName(collection.name);
            setAction("edit");
          }}
        >
          <Pencil size={17} />
        </IconButton>
        <IconButton
          label={`Excluir ${collection.name}`}
          onClick={() => setAction("delete")}
        >
          <Trash2 size={17} />
        </IconButton>
      </div>
      {action && (
        <Modal
          title={action === "edit" ? "Editar coleção" : "Excluir coleção?"}
          onClose={() => setAction(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (action === "edit")
                useLibrary
                  .getState()
                  .updateCollection(collection.id, name.trim());
              else useLibrary.getState().deleteCollection(collection.id);
              setAction(null);
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
                onClick={() => setAction(null)}
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
      )}
    </>
  );
}
