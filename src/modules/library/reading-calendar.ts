export function readingDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function addDailySeconds(
  days: Record<string, number> = {},
  seconds: number,
  date = new Date(),
) {
  const key = readingDate(date);
  return { ...days, [key]: (days[key] ?? 0) + Math.max(0, seconds) };
}
