"use client";
import { DatePickerInput } from "@mantine/dates";
import { Select } from "@mantine/core";
import {
  CalendarDays,
  Highlighter,
  StickyNote,
  ScanLine,
  Check,
} from "lucide-react";
import { Button, SelectField } from "@/components/ui/controls";
import type { ReaderDocument } from "@/shared/types";
import "dayjs/locale/pt-br";

export type KnowledgePeriod = [string | null, string | null];
const colorOptions = [
  { value: "all", label: "Todas as cores" },
  { value: "#e8bb45", label: "Amarelo" },
  { value: "#db7f88", label: "Rosa" },
  { value: "#6a997d", label: "Verde" },
  { value: "#7f9fc4", label: "Azul" },
  { value: "#3e3830", label: "Grafite" },
];
function ColorDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className={`knowledge-color-dot${color === "all" ? " knowledge-color-dot-all" : ""}`}
      style={color === "all" ? undefined : { backgroundColor: color }}
    />
  );
}
export function KnowledgeFilters({
  forcedKind,
  type,
  onType,
  document,
  onDocument,
  color,
  onColor,
  period,
  onPeriod,
  documents,
}: {
  forcedKind?: string;
  type: string;
  onType: (value: string) => void;
  document: string;
  onDocument: (value: string) => void;
  color: string;
  onColor: (value: string) => void;
  period: KnowledgePeriod;
  onPeriod: (value: KnowledgePeriod) => void;
  documents: ReaderDocument[];
}) {
  return (
    <div className="knowledge-filters">
      {!forcedKind && (
        <div
          className="knowledge-types"
          role="group"
          aria-label="Tipo de anotação"
        >
          <Button aria-pressed={type === "all"} onClick={() => onType("all")}>
            Tudo
          </Button>
          {[
            { id: "highlight", name: "Destaques", icon: Highlighter },
            { id: "note", name: "Anotações", icon: StickyNote },
            { id: "clipping", name: "Capturas", icon: ScanLine },
          ].map(({ id, name, icon: Icon }) => (
            <Button
              key={id}
              aria-pressed={type === id}
              onClick={() => onType(id)}
            >
              <Icon size={16} />
              {name}
            </Button>
          ))}
        </div>
      )}
      <div className="knowledge-filter-fields">
        <DatePickerInput
          type="range"
          label="Período"
          placeholder="Todas as datas"
          locale="pt-br"
          valueFormat="DD/MM/YYYY"
          value={period}
          onChange={onPeriod}
          allowSingleDateInRange
          clearable
          clearButtonProps={{ "aria-label": "Limpar período" }}
          leftSection={<CalendarDays size={17} />}
          popoverProps={{ position: "bottom-start", withinPortal: true }}
        />
        <label className="knowledge-filter-label" htmlFor="document-filter">
          Documento
          <SelectField
            id="document-filter"
            value={document}
            onChange={(e) => onDocument(e.target.value)}
          >
            <option value="all">Todos os documentos</option>
            {documents.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </SelectField>
        </label>
        <label className="knowledge-filter-label" htmlFor="color-filter">
          Cor
          <Select
            id="color-filter"
            aria-label="Cor"
            className="reader-select knowledge-color-filter"
            value={color}
            data={colorOptions}
            allowDeselect={false}
            onChange={(next) => {
              if (next !== null) onColor(next);
            }}
            leftSection={<ColorDot color={color} />}
            leftSectionPointerEvents="none"
            renderOption={({ option, checked }) => (
              <span className="knowledge-color-option">
                <ColorDot color={option.value} />
                <span>{option.label}</span>
                {checked && (
                  <Check
                    size={16}
                    aria-hidden="true"
                    className="knowledge-color-check"
                  />
                )}
              </span>
            )}
          />
        </label>
      </div>
    </div>
  );
}
