import { readingDate } from "@/modules/library/reading-calendar";

export function formatReadingTime(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  if (seconds > 0 && minutes === 0) return "Menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} h ${remaining} min` : `${hours} h`;
}

function readingDates(
  readingDays: Record<string, number>,
  length: number,
  now: Date,
) {
  return Array.from({ length }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - index);
    const key = readingDate(date);
    return { key, date, seconds: readingDays[key] ?? 0 };
  });
}

export function readingWeek(
  readingDays: Record<string, number> = {},
  now = new Date(),
) {
  return readingDates(readingDays, 7, now);
}

export function readingActivity(
  readingDays: Record<string, number> = {},
  length: number,
  goalMinutes: number,
  now = new Date(),
) {
  const days = readingDates(readingDays, length * 2, now);
  const current = days.slice(0, length);
  const previousSeconds = days
    .slice(length)
    .reduce((sum, day) => sum + day.seconds, 0);
  const totalSeconds = current.reduce((sum, day) => sum + day.seconds, 0);
  // UTC day numbers compare calendar dates without daylight-saving hour offsets.
  const todayIndex = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000,
  );
  const activeDates = new Set(
    Object.entries(readingDays).flatMap(([key, seconds]) => {
      const parsed = Date.parse(`${key}T00:00:00Z`);
      if (
        seconds <= 0 ||
        !Number.isFinite(parsed) ||
        new Date(parsed).toISOString().slice(0, 10) !== key
      )
        return [];
      const index = Math.floor(parsed / 86400000);
      return index <= todayIndex ? [index] : [];
    }),
  );
  let streak = 0;
  let cursor = activeDates.has(todayIndex) ? todayIndex : todayIndex - 1;
  while (activeDates.has(cursor)) {
    streak++;
    cursor--;
  }
  let bestStreak = 0;
  let run = 0;
  let previousIndex = -Infinity;
  for (const index of [...activeDates].sort((a, b) => a - b)) {
    run = index === previousIndex + 1 ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previousIndex = index;
  }
  return {
    days: current,
    totalSeconds,
    previousSeconds,
    activeDays: current.filter((day) => day.seconds > 0).length,
    goalDays: current.filter(
      (day) => day.seconds >= Math.max(1, goalMinutes) * 60,
    ).length,
    averageSeconds: totalSeconds / length,
    streak,
    bestStreak,
  };
}
