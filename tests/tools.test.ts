import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import { TOOLS } from "../src/tools.js";
import { FAKE_SPEND, fakeClient } from "./fake-client.js";

/** The exact tool list this release ships. approve_plan, steer and retry follow. */
const SHIPPED = ["get_metrics", "get_run", "list_events", "list_repos", "list_runs", "spend", "watch_events"];

test("the shipped tool list is exactly the seven read tools", () => {
  assert.deepEqual(TOOLS.map((t) => t.name).sort(), SHIPPED);
  assert.equal(new Set(TOOLS.map((t) => t.route)).size, TOOLS.length, "unique routes");
});

test("every tool is read-only and closed-world", () => {
  for (const t of TOOLS) {
    assert.deepEqual(t.annotations, {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    }, t.name);
  }
});

test("src imports only the SDK, zod, node builtins and files under src/", () => {
  const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../src");
  const builtins = new Set(builtinModules);
  const files = readdirSync(srcDir).filter((f) => f.endsWith(".ts"));
  assert.ok(files.length > 0);
  for (const f of files) {
    const text = readFileSync(resolve(srcDir, f), "utf8");
    const specs = [...text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const spec of specs) {
      const ok =
        spec.startsWith("@modelcontextprotocol/sdk/") ||
        spec === "zod" ||
        (spec.startsWith("node:") && builtins.has(spec.slice(5))) ||
        builtins.has(spec) ||
        (spec.startsWith(".") && (resolve(srcDir, spec) + sep).startsWith(srcDir + sep));
      assert.ok(ok, `${f} imports "${spec}"`);
    }
  }
});

async function connect() {
  const fake = fakeClient();
  const [a, b] = InMemoryTransport.createLinkedPair();
  await buildServer(fake).connect(a);
  const client = new Client({ name: "t", version: "0" });
  await client.connect(b);
  return { client, fake };
}

const text = (r: object) => ((r as { content: { text: string }[] }).content)[0]!.text;

test("each tool reaches the client with its arguments", async () => {
  const { client, fake } = await connect();
  await client.callTool({ name: "list_repos", arguments: {} });
  await client.callTool({ name: "list_runs", arguments: {} });
  await client.callTool({ name: "get_run", arguments: { repo: "factory-mcp", issue: "1" } });
  await client.callTool({ name: "list_events", arguments: { repo: "factory-mcp", issue: "1" } });
  await client.callTool({ name: "spend", arguments: {} });
  await client.callTool({ name: "get_metrics", arguments: {} });
  await client.callTool({ name: "watch_events", arguments: { seconds: 2, max_events: 5 } });
  await client.callTool({ name: "watch_events", arguments: {} });
  assert.deepEqual(fake.calls, [
    "repos",
    "runs",
    "run:factory-mcp:1",
    "events:factory-mcp:1",
    "spend",
    "metrics",
    "watch:2:5",
    "watch:5:100",
  ]);
});

test("spend returns the route body unchanged", async () => {
  const { client } = await connect();
  const res = await client.callTool({ name: "spend", arguments: {} });
  assert.equal(text(res), JSON.stringify(FAKE_SPEND));
  const tool = TOOLS.find((t) => t.name === "spend")!;
  assert.doesNotMatch(tool.description, /\$|model/i);
});

test("tools reject bad arguments and surface client errors", async () => {
  const { client } = await connect();
  const missing = await client.callTool({ name: "get_run", arguments: { repo: "factory-mcp" } }).catch((e) => e);
  assert.ok(missing instanceof Error || (missing as { isError?: boolean }).isError);
  const tooLong = await client.callTool({ name: "watch_events", arguments: { seconds: 999 } }).catch((e) => e);
  assert.ok(tooLong instanceof Error || (tooLong as { isError?: boolean }).isError);
  for (const name of ["get_run", "list_events"]) {
    const res = await client.callTool({ name, arguments: { repo: "x", issue: "9" } });
    assert.equal(res.isError, true, name);
  }
});
