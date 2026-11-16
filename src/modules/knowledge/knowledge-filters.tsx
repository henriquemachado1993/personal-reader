"use client";
import { DatePickerInput } from "@mantine/dates";
import { CalendarDays, Highlighter, StickyNote, ScanLine } from "lucide-react";
import { Button, SelectField } from "@/components/ui/controls";
import type { ReaderDocument } from "@/shared/types";
import "dayjs/locale/pt-br";

export type KnowledgePeriod = [string | null, string | null];
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
          <SelectField
            id="color-filter"
            value={color}
            onChange={(e) => onColor(e.target.value)}
          >
            <option value="all">Todas as cores</option>
            <option value="#e8bb45">Amarelo</option>
            <option value="#db7f88">Rosa</option>
            <option value="#6a997d">Verde</option>
            <option value="#7f9fc4">Azul</option>
            <option value="#3e3830">Grafite</option>
          </SelectField>
        </label>
      </div>
    </div>
  );
}
