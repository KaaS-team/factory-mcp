import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import { TOOLS } from "../src/tools.js";
import { createHttpClient } from "../src/http-client.js";
import { fakeClient } from "./fake-client.js";

async function connect(fake = fakeClient()) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await buildServer(fake).connect(a);
  const client = new Client({ name: "t", version: "0" });
  await client.connect(b);
  return { client, fake };
}

test("lists exactly the registered tools, all read-only", async () => {
  const { client } = await connect();
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), TOOLS.map((t) => t.name).sort());
  for (const t of tools) {
    assert.equal(t.annotations?.readOnlyHint, true, `${t.name}.readOnlyHint`);
    assert.equal(t.annotations?.destructiveHint, false, `${t.name}.destructiveHint`);
    assert.equal(t.annotations?.openWorldHint, false, `${t.name}.openWorldHint`);
  }
});

test("read tools return data from the injected client", async () => {
  const { client } = await connect();
  const list = await client.callTool({ name: "list_runs", arguments: {} });
  assert.match(JSON.stringify(list.content), /running/);
  const one = await client.callTool({ name: "get_run", arguments: { repo: "factory-mcp", issue: "1" } });
  assert.match(JSON.stringify(one.content), /running/);
});

test("client errors become isError results; bad input is rejected", async () => {
  const { client } = await connect();
  const res = await client.callTool({ name: "get_run", arguments: { repo: "nope", issue: "1" } });
  assert.equal(res.isError, true);
  const bad = await client.callTool({ name: "get_run", arguments: {} }).catch((e) => e);
  assert.ok(bad instanceof Error || (bad as { isError?: boolean }).isError);
});

test("entry point wires the server and client (no orphan tools)", () => {
  const bin = readFileSync(new URL("../../bin/factory-mcp.ts", import.meta.url), "utf8");
  assert.match(bin, /buildServer/);
  const server = readFileSync(new URL("../../src/server.ts", import.meta.url), "utf8");
  assert.match(server, /for \(const tool of TOOLS\)/);
});

test("http client sends bearer token and maps routes (fake fetch)", async () => {
  const seen: { url: string; auth: string | null; method: string }[] = [];
  const f: typeof fetch = async (input, init) => {
    seen.push({
      url: String(input),
      auth: new Headers(init?.headers).get("authorization"),
      method: init?.method ?? "GET",
    });
    return new Response(JSON.stringify([]), { status: 200 });
  };
  const c = createHttpClient("http://x/", "tok", f);
  await c.listRepos();
  await c.listRuns();
  await c.getRun({ repo: "a/b", issue: "7" });
  await c.listEvents({ repo: "r", issue: "7" });
  await c.spend();
  await c.getMetrics();
  assert.deepEqual(seen.map((s) => [s.method, s.url, s.auth]), [
    ["GET", "http://x/api/repos", "Bearer tok"],
    ["GET", "http://x/api/runs", "Bearer tok"],
    ["GET", "http://x/api/runs/a%2Fb/7", "Bearer tok"],
    ["GET", "http://x/api/runs/r/7/events", "Bearer tok"],
    ["GET", "http://x/api/spend", "Bearer tok"],
    ["GET", "http://x/api/metrics", "Bearer tok"],
  ]);
  const bad = createHttpClient("http://x", "t", async () => new Response("", { status: 500 }));
  await assert.rejects(bad.listRuns(), /500/);
});
