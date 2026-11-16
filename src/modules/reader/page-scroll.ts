/** Finds the first page crossing the reading line without measuring every page. */
export function findVisiblePage<T>(
  pages: readonly T[],
  bottom: (page: T) => number,
  readingLine: number,
): T | undefined {
  let left = 0;
  let right = pages.length;
  while (left < right) {
    const middle = (left + right) >>> 1;
    if (bottom(pages[middle]) > readingLine) right = middle;
    else left = middle + 1;
  }
  return pages[left];
}

export function scrollToReaderPage(host: HTMLElement, page: HTMLElement) {
  const protectedTop = parseFloat(getComputedStyle(host).paddingTop) || 0;
  host.scrollTo({
    top:
      host.scrollTop +
      page.getBoundingClientRect().top -
      host.getBoundingClientRect().top -
      protectedTop,
    behavior: "instant",
  });
}
