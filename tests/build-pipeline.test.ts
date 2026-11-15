import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("npm build refreshes a cached Prisma client before Next compiles", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "reader-build-"));
  try {
    const { scripts } = JSON.parse(await readFile("package.json", "utf8"));
    await writeFile(join(fixture, "package.json"), JSON.stringify({ scripts }));
    await mkdir(join(fixture, "node_modules", ".bin"), { recursive: true });
    await mkdir(join(fixture, "scripts"), { recursive: true });
    await mkdir(join(fixture, "node_modules", "pdfjs-dist", "build"), {
      recursive: true,
    });
    await writeFile(
      join(fixture, "scripts", "copy-pdf-worker.mjs"),
      await readFile("scripts/copy-pdf-worker.mjs"),
    );
    await writeFile(
      join(
        fixture,
        "node_modules",
        "pdfjs-dist",
        "build",
        "pdf.worker.min.mjs",
      ),
      "worker-fixture",
    );
    await writeFile(join(fixture, "client-version"), "stale");
    const executables = {
      prisma: 'require("fs").writeFileSync("client-version", "current");',
      next: 'if(require("fs").readFileSync("client-version","utf8")!=="current") { console.error("Stale Prisma client reached Next build"); process.exit(1); }',
    };
    for (const [name, source] of Object.entries(executables)) {
      const entry = join(fixture, `${name}.cjs`);
      await writeFile(entry, source);
      if (process.platform === "win32")
        await writeFile(
          join(fixture, "node_modules", ".bin", `${name}.cmd`),
          `@"${process.execPath}" "%~dp0..\\..\\${name}.cjs" %*\r\n`,
        );
      else
        await writeFile(
          join(fixture, "node_modules", ".bin", name),
          `#!/bin/sh\n"${process.execPath}" "${entry}" "$@"\n`,
          { mode: 0o755 },
        );
    }
    const result = spawnSync(
      process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm",
      process.platform === "win32"
        ? ["/d", "/s", "/c", "npm run build"]
        : ["run", "build"],
      {
        cwd: fixture,
        encoding: "utf8",
        timeout: 30000,
      },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(
      await readFile(join(fixture, "client-version"), "utf8"),
      "current",
    );
    assert.equal(
      await readFile(join(fixture, "public", "pdf.worker.min.mjs"), "utf8"),
      "worker-fixture",
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
