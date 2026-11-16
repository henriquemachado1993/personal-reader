import { mkdir, writeFile } from "node:fs/promises";
await mkdir("public/covers", { recursive: true });
const books = [
  {
    id: "dom-casmurro",
    bg: "#244c46",
    fg: "#e9dbac",
    author: "MACHADO DE ASSIS",
    lines: ["Dom", "Casmurro"],
    titleY: 86,
    size: 47,
    motif: "arches",
  },
  {
    id: "metamorfose",
    bg: "#b64b32",
    fg: "#f7e6be",
    author: "FRANZ KAFKA",
    lines: ["A meta-", "morfose"],
    titleY: 83,
    size: 45,
    motif: "circles",
  },
  {
    id: "meditacoes",
    bg: "#c4b696",
    fg: "#343c32",
    author: "MARCO AURÉLIO",
    lines: ["Meditações"],
    titleY: 104,
    size: 37,
    motif: "columns",
  },
  {
    id: "desassossego",
    bg: "#e4dbc9",
    fg: "#3d5047",
    author: "FERNANDO PESSOA",
    lines: ["Livro do", "desassossego"],
    titleY: 83,
    size: 31,
    motif: "window",
  },
  {
    id: "orgulho",
    bg: "#727e64",
    fg: "#f7edd8",
    author: "JANE AUSTEN",
    lines: ["Orgulho e", "preconceito"],
    titleY: 77,
    size: 33,
    motif: "rings",
  },
  {
    id: "frankenstein",
    bg: "#263c49",
    fg: "#d6d5b5",
    author: "MARY SHELLEY",
    lines: ["Franken-", "stein"],
    titleY: 83,
    size: 41,
    motif: "lightning",
  },
  {
    id: "arte-guerra",
    bg: "#9b3b32",
    fg: "#f4dfb7",
    author: "SUN TZU",
    lines: ["A arte", "da guerra"],
    titleY: 85,
    size: 43,
    motif: "sun",
  },
  {
    id: "cortico",
    bg: "#c28849",
    fg: "#342f25",
    author: "ALUÍSIO AZEVEDO",
    lines: ["O cortiço"],
    titleY: 98,
    size: 43,
    motif: "houses",
  },
];
const motifs = {
  arches: (f) =>
    `<g fill="none" stroke="${f}" stroke-width="1.2" opacity=".65">${Array.from({ length: 6 }, (_, i) => `<path d="M${35 + i * 12} 283V211a${85 - i * 12} ${85 - i * 12} 0 0 1 ${170 - i * 24} 0v72"/>`).join("")}</g>`,
  circles: (f) =>
    `<g fill="none" stroke="${f}" opacity=".7">${Array.from({ length: 10 }, (_, i) => `<circle cx="120" cy="247" r="${16 + i * 7}" stroke-width="${i === 8 ? 4 : 1}"/>`).join("")}</g>`,
  columns: (f) =>
    `<g stroke="${f}" fill="none" opacity=".7"><path d="M42 275h156M42 180h156M48 174h144" stroke-width="3"/>${Array.from({ length: 8 }, (_, i) => `<path d="M${55 + i * 18} 185v82" stroke-width="5"/>`).join("")}</g>`,
  window: (f) =>
    `<g fill="none" stroke="${f}" stroke-width="2"><path d="M65 280V191a55 55 0 0 1 110 0v89Z"/><path d="M120 139v141M65 210h110"/><path d="M52 289h136" stroke-width="5"/></g>`,
  rings: (f) =>
    `<g stroke="${f}" fill="none" opacity=".6">${[36, 53, 70].map((r) => `<circle cx="120" cy="241" r="${r}"/>`).join("")}<path d="m50 241 70-70 70 70-70 70Z"/><path d="M50 241h140M120 171v140"/></g>`,
  lightning: (f) =>
    `<path d="m132 168-42 78h34l-16 58 54-86h-37l23-50Z" fill="${f}"/><path d="M43 168h35m88 0h31M43 304h35m88 0h31" stroke="${f}" opacity=".5"/>`,
  sun: (f) =>
    `<circle cx="120" cy="231" r="51" fill="${f}"/><path d="M35 256h170M35 267h170M35 278h170M35 289h170" stroke="#9b3b32" stroke-width="5"/>`,
  houses: (f) =>
    `<g fill="none" stroke="${f}" opacity=".8">${Array.from({ length: 5 }, (_, i) => `<path d="M${31 + i * 36} 283v-74l18-24 18 24v74Zm10-14v-24h15v24m-15-40v-12h15v12"/>`).join("")}</g>`,
};
for (const b of books) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="720" viewBox="0 0 240 360"><title>${b.lines.join(" ")} — ${b.author}</title><metadata>Original typographic vector cover, created for Le-Books sample library. Geometric artwork and lettering authored in scripts/generate-covers.mjs; not an existing publisher edition.</metadata><rect width="240" height="360" fill="${b.bg}"/><path d="M11 0v360" stroke="#000" opacity=".14"/><text x="28" y="34" fill="${b.fg}" font-family="sans-serif" font-size="8" letter-spacing="1.1">${b.author}</text>${b.lines.map((line, i) => `<text x="26" y="${b.titleY + i * b.size * 1.12}" fill="${b.fg}" font-family="Georgia,serif" font-size="${b.size}" letter-spacing="-1">${line}</text>`).join("")}${motifs[b.motif](b.fg)}<path d="M28 327h184" stroke="${b.fg}" opacity=".35"/><text x="28" y="345" fill="${b.fg}" font-family="sans-serif" font-size="6" letter-spacing="1.5">BIBLIOTECA PESSOAL</text></svg>`;
  await writeFile(`public/covers/${b.id}.svg`, svg);
}
