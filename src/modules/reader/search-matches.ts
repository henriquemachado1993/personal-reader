export function findTextMatches(text: string, query: string) {
  const needle = query.trim();
  if (!needle) return [];
  const pattern = new RegExp(
    needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "giu",
  );
  return Array.from(text.matchAll(pattern), (match) => ({
    start: match.index!,
    end: match.index! + match[0].length,
  }));
}

export function textMatchRanges(root: HTMLElement, query: string) {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
  );
  const nodes: { node: Text; start: number; end: number }[] = [];
  let text = "";
  let node;
  while ((node = walker.nextNode())) {
    const start = text.length;
    text += node.textContent ?? "";
    nodes.push({ node: node as Text, start, end: text.length });
  }
  return findTextMatches(text, query).flatMap((match) => {
    const first = nodes.find((item) => item.end > match.start);
    const last = nodes.find((item) => item.end >= match.end);
    if (!first || !last) return [];
    const range = root.ownerDocument.createRange();
    range.setStart(first.node, match.start - first.start);
    range.setEnd(last.node, match.end - last.start);
    return [range];
  });
}

export function showSearchHighlights(
  root: HTMLElement,
  ranges: Range[],
  active: Range | undefined,
  key: string,
) {
  const view = root.ownerDocument.defaultView as
    (Window & typeof globalThis) | null;
  if (!view?.CSS?.highlights || !view.Highlight) return () => {};
  const style = root.ownerDocument.createElement("style");
  style.textContent = `::highlight(${key}) { background-color: #ffe06680; } ::highlight(${key}-active) { background-color: #ffad338f; text-decoration: underline; }`;
  root.ownerDocument.head.append(style);
  view.CSS.highlights.set(key, new view.Highlight(...ranges));
  if (active) {
    const highlight = new view.Highlight(active);
    highlight.priority = 1;
    view.CSS.highlights.set(`${key}-active`, highlight);
  }
  return () => {
    style.remove();
    view.CSS.highlights.delete(key);
    view.CSS.highlights.delete(`${key}-active`);
  };
}
