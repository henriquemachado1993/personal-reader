import { Workspace } from "@/components/layout/workspace";
import type { Metadata } from "next";

const sectionTitles: Record<string, string> = {
  library: "Biblioteca",
  knowledge: "Conhecimento",
  notes: "Anotações",
  highlights: "Destaques",
  clippings: "Capturas",
  collections: "Coleções",
  history: "Histórico",
  statistics: "Estatísticas",
  settings: "Configurações",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}): Promise<Metadata> {
  const { section } = await params;
  const title = section?.[0]
    ? (sectionTitles[section[0]] ?? "Biblioteca")
    : "Início";
  return { title: `${title} · Le-Books` };
}

export default function Page() {
  return <Workspace />;
}
