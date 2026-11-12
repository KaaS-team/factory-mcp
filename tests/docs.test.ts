import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDocs } from "./docs-check.js";

function repo(readme: string, extra: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "docs-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { build: "x" } }));
  writeFileSync(join(root, "Makefile"), "check:\n\ttrue\n");
  writeFileSync(join(root, "README.md"), readme);
  for (const [p, c] of Object.entries(extra)) {
    mkdirSync(join(root, p, ".."), { recursive: true });
    writeFileSync(join(root, p), c);
  }
  return root;
}

test("docs: this repo's markdown links and README commands resolve", () => {
  assert.deepEqual(checkDocs(process.cwd()), []);
});

test("docs: a relative link to a missing file is reported", () => {
  const root = repo("see [guide](docs/guide.md) and [web](https://example.com) and [top](#top)\n");
  assert.deepEqual(checkDocs(root), ["README.md: broken link docs/guide.md"]);
});

test("docs: a relative link to an existing file passes, in any markdown file", () => {
  const root = repo("[g](docs/guide.md)\n", { "docs/guide.md": "[back](../README.md) [gone](nope.md)\n" });
  assert.deepEqual(checkDocs(root), ["docs/guide.md: broken link nope.md"]);
});

test("docs: README sh blocks naming a missing npm script, Make target or file are reported", () => {
  const root = repo(
    "```sh\nnpm run build\nnpm run nope\nmake check\nmake nope\nnode dist/bin/x.js\nnode bin/x.ts\n```\n",
    { "bin/x.ts": "" },
  );
  assert.deepEqual(checkDocs(root), [
    "README.md: npm script not in package.json: nope",
    "README.md: Make target not in Makefile: nope",
  ]);
});
