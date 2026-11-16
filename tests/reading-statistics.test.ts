import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatReadingTime,
  readingWeek,
  readingActivity,
} from "../src/modules/settings/reading-statistics";

test("reading durations distinguish empty, sub-minute and hourly totals", () => {
  assert.equal(formatReadingTime(0), "0 min");
  assert.equal(formatReadingTime(30), "Menos de 1 min");
  assert.equal(formatReadingTime(60), "1 min");
  assert.equal(formatReadingTime(3600), "1 h");
  assert.equal(formatReadingTime(3660), "1 h 1 min");
});

test("the reading week contains seven local calendar dates across month boundaries", () => {
  const week = readingWeek(
    {
      "2026-03-01": 720,
      "2026-02-28": 1800,
      "2026-02-23": 60,
      "2026-02-22": 9999,
    },
    new Date(2026, 2, 1, 12),
  );
  assert.deepEqual(
    week.map((day) => day.key),
    [
      "2026-03-01",
      "2026-02-28",
      "2026-02-27",
      "2026-02-26",
      "2026-02-25",
      "2026-02-24",
      "2026-02-23",
    ],
  );
  assert.equal(
    week.reduce((sum, day) => sum + day.seconds, 0),
    2580,
  );
  assert.equal(week[2].seconds, 0);
});

test("activity compares equal periods and includes inactive days in the average", () => {
  const activity = readingActivity(
    {
      "2026-11-16": 1200,
      "2026-11-15": 600,
      "2026-11-09": 300,
      "2026-11-08": 900,
    },
    7,
    20,
    new Date(2026, 10, 16, 12),
  );
  assert.equal(activity.totalSeconds, 1800);
  assert.equal(activity.previousSeconds, 1200);
  assert.equal(activity.activeDays, 2);
  assert.equal(activity.goalDays, 1);
  assert.equal(activity.averageSeconds, 1800 / 7);
  assert.equal(activity.days.length, 7);
});

test("streak remains alive through yesterday and ignores future or invalid dates", () => {
  const days = {
    "2026-11-15": 60,
    "2026-11-14": 60,
    "2026-11-13": 60,
    "2026-10-01": 60,
    "2026-10-02": 60,
    "2026-10-03": 60,
    "2026-10-04": 60,
    "2026-11-17": 60,
    "2026-11-18": 60,
    "2026-11-19": 60,
    "2026-11-20": 60,
    "2026-11-21": 60,
    "2026-02-31": 60,
  };
  const activity = readingActivity(days, 30, 20, new Date(2026, 10, 16, 12));
  assert.equal(activity.streak, 3);
  assert.equal(activity.bestStreak, 4);
  assert.equal(
    readingActivity(days, 7, 20, new Date(2026, 10, 23, 12)).streak,
    0,
  );
  assert.equal(
    readingActivity({}, 7, 20, new Date(2026, 10, 16)).bestStreak,
    0,
  );
});
