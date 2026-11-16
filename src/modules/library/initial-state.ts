import type { LibraryState } from "@/shared/types";

export function initialState(): LibraryState {
  return {
    documents: [],
    collections: [],
    annotations: [],
    bookmarks: [],
    readingSeconds: 0,
    readingDays: {},
    preferences: {
      theme: "light",
      fontSize: 19,
      readerTheme: "paper",
      dailyGoal: 20,
    },
  };
}
