import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import { TOOLS, type ToolDef } from "../src/tools.js";
import { FAKE_SPEND, fakeClient } from "./fake-client.js";

type Kind = "read" | "write";

/** Every tool must appear here. A tool missing from this table fails the test below. */
const CLASSIFICATION: Record<string, Kind> = {
  list_tasks: "read",
  get_task: "read",
  list_events: "read",
  spend: "read",
  list_repos: "read",
  list_plugins: "read",
  create_task: "write",
  hand_off_task: "write",
  approve_plan: "write",
  steer: "write",
  queue_followup: "write",
  retry: "write",
};

const ROUTES: Record<string, string> = {
  approve_plan: "runs.approve",
  steer: "runs.steer",
  queue_followup: "runs.queue",
  retry: "runs.retry",
  list_events: "runs.events",
  spend: "spend.get",
  list_repos: "repos.list",
  list_plugins: "plugins.list",
};

/** read / write / destructive, derived from the annotations only. */
function classify(t: ToolDef): "read" | "write" | "destructive" {
  const a = t.annotations;
  assert.equal(typeof a.readOnlyHint, "boolean", `${t.name}.readOnlyHint is declared`);
  assert.equal(typeof a.destructiveHint, "boolean", `${t.name}.destructiveHint is declared`);
  assert.ok(!(a.readOnlyHint && a.destructiveHint), `${t.name} cannot be both read-only and destructive`);
  if (a.readOnlyHint) return "read";
  return a.destructiveHint ? "destructive" : "write";
}

test("every tool in TOOLS is classified, and has a unique name and route", () => {
  const names = TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, "unique names");
  assert.deepEqual([...names].sort(), Object.keys(CLASSIFICATION).sort(), "tool set equals classified set");
  assert.equal(new Set(TOOLS.map((t) => t.route)).size, TOOLS.length, "unique routes");
  for (const t of TOOLS) classify(t);
});

test("list_*, get_*, spend are read-only; the rest are writes", () => {
  for (const t of TOOLS) {
    const kind = classify(t);
    if (/^(list_|get_)/.test(t.name) || t.name === "spend") {
      assert.equal(kind, "read", t.name);
    } else {
      assert.notEqual(kind, "read", `${t.name} must not be read-only`);
      assert.equal(t.annotations.readOnlyHint, false, t.name);
    }
    assert.equal(CLASSIFICATION[t.name] === "read", kind === "read", `${t.name} matches table`);
  }
  for (const n of ["retry", "steer", "approve_plan", "hand_off_task", "create_task", "queue_followup"]) {
    assert.equal(TOOLS.find((t) => t.name === n)?.annotations.readOnlyHint, false, n);
  }
});

test("new tools map to their route ids", () => {
  for (const [name, route] of Object.entries(ROUTES)) {
    assert.equal(TOOLS.find((t) => t.name === name)?.route, route, name);
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

test("each new tool reaches the client with its arguments", async () => {
  const { client, fake } = await connect();
  await client.callTool({ name: "approve_plan", arguments: { id: "t1" } });
  await client.callTool({ name: "steer", arguments: { id: "t1", message: "go left" } });
  await client.callTool({ name: "queue_followup", arguments: { id: "t1", message: "then docs" } });
  await client.callTool({ name: "retry", arguments: { id: "t1" } });
  await client.callTool({ name: "list_repos", arguments: {} });
  await client.callTool({ name: "list_plugins", arguments: {} });
  assert.deepEqual(fake.calls, [
    "approve:t1",
    "steer:t1:go left",
    "queue:t1:then docs",
    "retry:t1",
    "repos",
    "plugins",
  ]);
});

test("write tools are visible through list_events", async () => {
  const { client } = await connect();
  await client.callTool({ name: "steer", arguments: { id: "t1", message: "go left" } });
  await client.callTool({ name: "queue_followup", arguments: { id: "t1", message: "then docs" } });
  const events = JSON.parse(text(await client.callTool({ name: "list_events", arguments: { id: "t1" } })));
  assert.deepEqual(events.map((e: { kind: string }) => e.kind), ["steer", "queued"]);
});

test("spend returns the route body unchanged", async () => {
  const { client } = await connect();
  const res = await client.callTool({ name: "spend", arguments: {} });
  assert.equal(text(res), JSON.stringify(FAKE_SPEND));
  const tool = TOOLS.find((t) => t.name === "spend")!;
  assert.doesNotMatch(tool.description, /\$|model/i);
});

test("new tools reject missing arguments and surface client errors", async () => {
  const { client } = await connect();
  const missing = await client.callTool({ name: "steer", arguments: { id: "t1" } }).catch((e) => e);
  assert.ok(missing instanceof Error || (missing as { isError?: boolean }).isError);
  for (const name of ["approve_plan", "retry", "list_events"]) {
    const res = await client.callTool({ name, arguments: { id: "nope" } });
    assert.equal(res.isError, true, name);
  }
});
