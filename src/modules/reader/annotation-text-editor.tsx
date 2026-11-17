"use client";
import { FocusTrap } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { Button, TextArea, TextField } from "@/components/ui/controls";

export function AnnotationTextEditor({
  anchor,
  text = "",
  fontSize = 18,
  editing,
  onSave,
  onCancel,
}: {
  anchor: { x: number; y: number };
  text?: string;
  fontSize?: number;
  editing: boolean;
  onSave: (text: string, fontSize: number) => string | void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(text);
  const [size, setSize] = useState(Math.round(fontSize));
  const [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const [position, setPosition] = useState({
    left: 12,
    top: 12,
    maxHeight: 500,
  });
  useEffect(() => {
    const fit = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? innerHeight;
      const top = viewport?.offsetTop ?? 0;
      setPosition({
        left: Math.max(
          12,
          Math.min(anchor.x, innerWidth - Math.min(320, innerWidth - 24) - 12),
        ),
        top: Math.max(
          top + 12,
          Math.min(
            anchor.y,
            top + height - (form.current?.offsetHeight ?? 280) - 12,
          ),
        ),
        maxHeight: Math.max(120, height - 24),
      });
    };
    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
    };
  }, [anchor]);
  return (
    <FocusTrap active innerRef={form}>
      <form
        ref={form}
        role="dialog"
        aria-label={
          editing ? "Editar texto na página" : "Inserir texto na página"
        }
        className="annotation-text-editor annotation-popup"
        style={position}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            event.preventDefault();
            onCancel();
          }
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.stopPropagation();
            event.preventDefault();
            form.current?.requestSubmit();
          }
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) setError(onSave(value.trim(), size) || "");
        }}
      >
        <label htmlFor="annotation-text-value">
          {editing ? "Editar texto" : "Texto na página"}
        </label>
        <TextArea
          id="annotation-text-value"
          aria-label="Texto na página"
          data-autofocus
          value={value}
          maxLength={2000}
          rows={4}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
        />
        <label className="annotation-font-size" htmlFor="annotation-font-size">
          Tamanho
          <TextField
            id="annotation-font-size"
            aria-label="Tamanho do texto"
            type="number"
            min={8}
            max={72}
            value={size}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (next >= 8 && next <= 72) setSize(next);
            }}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="annotation-editor-actions">
          <Button type="button" className="button secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="button primary" disabled={!value.trim()}>
            Salvar texto
          </Button>
        </div>
      </form>
    </FocusTrap>
  );
}
