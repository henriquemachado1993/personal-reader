import { test } from "node:test";
import assert from "node:assert/strict";
import { appVersion, releaseNotes } from "../src/shared/app-release";
import lockfile from "../package-lock.json";

test("the installed package, lockfile and current release notes share a version", () => {
  assert.equal(appVersion, lockfile.version);
  assert.equal(appVersion, lockfile.packages[""].version);
  assert.equal(releaseNotes[0]?.version, appVersion);
});

test("release history contains unique versions, valid dates and readable changes", () => {
  const versions = new Set<string>();
  for (const release of releaseNotes) {
    assert.match(release.version, /^\d+\.\d+\.\d+$/);
    assert.equal(versions.has(release.version), false);
    versions.add(release.version);
    assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(
      new Date(`${release.date}T12:00:00Z`).toISOString().slice(0, 10),
      release.date,
    );
    assert.ok(release.title.trim());
    assert.ok(release.sections.length);
    for (const section of release.sections) {
      assert.ok(section.title.trim());
      assert.ok(section.items.length);
      assert.ok(section.items.every((item) => item.trim().length));
    }
  }
  for (let index = 1; index < releaseNotes.length; index++) {
    const current = releaseNotes[index - 1].version.split(".").map(Number);
    const previous = releaseNotes[index].version.split(".").map(Number);
    const differingPart = current.findIndex(
      (value, part) => value !== previous[part],
    );
    assert.ok(
      differingPart >= 0 && current[differingPart] > previous[differingPart],
      "newer versions appear first",
    );
  }
});
