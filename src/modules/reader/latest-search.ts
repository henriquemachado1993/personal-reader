export function createLatestSearch() {
  let revision = 0;
  return {
    invalidate() {
      revision++;
    },
    async run<T>(
      search: () => Promise<T>,
    ): Promise<
      | { status: "success"; value: T }
      | { status: "error" }
      | { status: "obsolete" }
    > {
      const current = ++revision;
      try {
        const value = await search();
        return current === revision
          ? { status: "success", value }
          : { status: "obsolete" };
      } catch {
        return current === revision
          ? { status: "error" }
          : { status: "obsolete" };
      }
    },
  };
}
