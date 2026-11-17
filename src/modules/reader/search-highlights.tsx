"use client";
import { useEffect, useRef } from "react";
import { showSearchHighlights, textMatchRanges } from "./search-matches";

export function SearchHighlights({
  query,
  active,
  page,
}: {
  query: string;
  active: number;
  page: number;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = anchor.current?.closest<HTMLElement>("[data-reader-page]");
    const root = host?.querySelector<HTMLElement>(".textLayer, .prose-page");
    if (!root || !query) return;
    let clear = () => {};
    let scrolled = false;
    let frame = 0;
    const update = () => {
      clear();
      const ranges = textMatchRanges(root, query);
      const selected = ranges[active];
      clear = showSearchHighlights(
        root,
        ranges,
        selected,
        `reader-search-${page}`,
      );
      if (selected && !scrolled && selected.getClientRects().length) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            const scroll = host?.closest<HTMLElement>(".reader-scroll-area");
            if (scroll) {
              scroll.scrollTop +=
                selected.getBoundingClientRect().top -
                scroll.getBoundingClientRect().top -
                scroll.clientHeight * 0.35;
              scrolled = true;
            }
          });
        });
      }
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      clear();
    };
  }, [query, active, page]);
  return <span ref={anchor} hidden />;
}
