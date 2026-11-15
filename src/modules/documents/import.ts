import type { DocumentFormat, ReaderDocument } from "@/shared/types";
import { saveFile } from "@/infrastructure/storage/local";
const formats: Record<string, DocumentFormat> = {
  pdf: "PDF",
  epub: "EPUB",
  docx: "DOCX",
  txt: "TXT",
};
export const MAX_FILE_SIZE = 100 * 1024 * 1024;
export function detectFormat(filename: string): DocumentFormat | undefined {
  return formats[filename.split(".").pop()?.toLowerCase() ?? ""];
}
export function paginateText(text: string, maxLength = 2400): string[] {
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  const pages: string[] = [];
  let page = "";
  for (const paragraph of paragraphs) {
    const chunks = paragraph.match(
      new RegExp(`[^]{1,${maxLength}}(?:\\s|$)|[^]{1,${maxLength}}`, "g"),
    ) ?? [paragraph];
    for (const chunk of chunks) {
      if (page.length + chunk.length > maxLength && page) {
        pages.push(page.trim());
        page = "";
      }
      page += `${chunk}\n\n`;
    }
  }
  if (page.trim()) pages.push(page.trim());
  return pages.length ? pages : ["Este documento não contém texto."];
}
export async function importDocument(file: File): Promise<ReaderDocument> {
  const format = detectFormat(file.name);
  if (!format)
    throw new Error(
      `${file.name}: formato não suportado. Use PDF, EPUB, DOCX ou TXT.`,
    );
  if (file.size > MAX_FILE_SIZE)
    throw new Error(`${file.name}: o limite local é de 100 MB por arquivo.`);
  if (!file.size) throw new Error(`${file.name}: o arquivo está vazio.`);
  const id = crypto.randomUUID();
  let content: string[] | undefined;
  let cover = "",
    title = file.name.replace(/\.[^.]+$/, "").replace(/[_]/g, " "),
    author = "Autor não informado",
    pageCount = 1;
  if (format === "PDF") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    }).promise;
    try {
      pageCount = pdf.numPages;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (context) {
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        cover = canvas.toDataURL("image/webp", 0.8);
      }
      const metadata = await pdf.getMetadata();
      const info = metadata.info as { Title?: string; Author?: string };
      if (info.Title?.trim()) title = info.Title;
      if (info.Author?.trim()) author = info.Author;
    } finally {
      await pdf.destroy();
    }
  }
  if (format === "EPUB") {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(file);
    const parser = new DOMParser();
    const container = await zip.file("META-INF/container.xml")?.async("string");
    if (!container)
      throw new Error(
        "EPUB inválido: o sumário do arquivo não foi encontrado.",
      );
    const path = parser
      .parseFromString(container, "application/xml")
      .querySelector("rootfile")
      ?.getAttribute("full-path");
    const source = path ? await zip.file(path)?.async("string") : undefined;
    if (!source)
      throw new Error("EPUB inválido: os metadados não foram encontrados.");
    const metadata = parser.parseFromString(source, "application/xml");
    title =
      metadata.getElementsByTagNameNS("*", "title")[0]?.textContent?.trim() ||
      title;
    author =
      metadata.getElementsByTagNameNS("*", "creator")[0]?.textContent?.trim() ||
      author;
    const coverId = metadata
      .querySelector('meta[name="cover"]')
      ?.getAttribute("content");
    const item = Array.from(metadata.querySelectorAll("manifest > item")).find(
      (i) =>
        i.getAttribute("id") === coverId ||
        i.getAttribute("properties")?.includes("cover-image"),
    );
    const href = item?.getAttribute("href");
    if (href && path) {
      const parent = path.slice(0, path.lastIndexOf("/") + 1);
      const resolved = new URL(
        href,
        `https://epub.local/${parent}`,
      ).pathname.slice(1);
      const image = await zip
        .file(decodeURIComponent(resolved))
        ?.async("uint8array");
      if (image && image.length < 5 * 1024 * 1024)
        cover = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(
            new Blob([new Uint8Array(image)], {
              type: item?.getAttribute("media-type") ?? "image/jpeg",
            }),
          );
        });
    }
  }
  if (format === "TXT") content = paginateText(await file.text());
  if (format === "DOCX") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer(),
    });
    content = paginateText(result.value);
  }
  const result: ReaderDocument = {
    id,
    title,
    author,
    format,
    filename: file.name,
    cover,
    color: ["#244c46", "#b6a584", "#b64b32", "#263c49"][
      Math.floor(Math.random() * 4)
    ],
    status: "want",
    progress: 0,
    page: 0,
    pages: content?.length ?? pageCount,
    collections: [],
    size: file.size,
    addedAt: new Date().toISOString(),
    content,
  };
  await saveFile(id, file);
  return result;
}
