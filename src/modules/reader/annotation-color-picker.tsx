"use client";

import { ColorPicker } from "@mantine/core";
import { useEffect, useState } from "react";
import { TextField } from "@/components/ui/controls";

export function AnnotationColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  const [hexDraft, setHexDraft] = useState(color);
  const [pickerRevision, setPickerRevision] = useState(0);
  useEffect(() => setHexDraft(color), [color]);

  return (
    <div className="annotation-color-picker">
      <span className="annotation-color-title">Cor personalizada</span>
      <ColorPicker
        key={pickerRevision}
        fullWidth
        format="hex"
        value={color}
        onChange={onChange}
        hueLabel="Tonalidade"
        saturationLabel="Saturação e luminosidade"
        styles={{
          saturation: {
            height: "clamp(80px, 20dvh, 150px)",
            touchAction: "none",
          },
          slider: { touchAction: "none", marginBlock: 14 },
        }}
      />
      <label className="annotation-color-code">
        <span>HEX</span>
        <TextField
          aria-label="Cor personalizada"
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
          value={hexDraft}
          onChange={(event) => {
            const nextColor = event.target.value;
            setHexDraft(nextColor);
            if (/^#[\da-f]{6}$/i.test(nextColor)) {
              onChange(nextColor.toLowerCase());
              // A manual value must replace Mantine's brief post-drag state.
              setPickerRevision((revision) => revision + 1);
            }
          }}
          onBlur={() => setHexDraft(color)}
        />
      </label>
    </div>
  );
}
