import { Reader } from "@/modules/reader/reader";
export default async function ReaderPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  return <Reader documentId={documentId} />;
}
