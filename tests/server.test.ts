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

const EXPECTED = {
  list_tasks: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  get_task: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  create_task: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  hand_off_task: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  approve_plan: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  steer: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  queue_followup: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  retry: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  list_events: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  spend: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  list_repos: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  get_metrics: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
} as const;

test("lists exactly the registered tools with the right annotations", async () => {
  const { client } = await connect();
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), Object.keys(EXPECTED).sort());
  assert.deepEqual(tools.map((t) => t.name).sort(), TOOLS.map((t) => t.name).sort());
  for (const t of tools) {
    const want = EXPECTED[t.name as keyof typeof EXPECTED];
    assert.ok(t.annotations, `${t.name} has annotations`);
    for (const [k, v] of Object.entries(want)) {
      assert.equal((t.annotations as Record<string, unknown>)[k], v, `${t.name}.${k}`);
    }
    assert.equal(t.annotations.openWorldHint, false, `${t.name}.openWorldHint`);
  }
});

test("read tools return data from the injected client", async () => {
  const { client } = await connect();
  const list = await client.callTool({ name: "list_tasks", arguments: {} });
  assert.match(JSON.stringify(list.content), /first/);
  const one = await client.callTool({ name: "get_task", arguments: { id: "t1" } });
  assert.match(JSON.stringify(one.content), /running/);
});

test("write tools reach the client and show in reads", async () => {
  const { client, fake } = await connect();
  await client.callTool({ name: "create_task", arguments: { title: "second" } });
  await client.callTool({ name: "hand_off_task", arguments: { id: "t1", to: "bo" } });
  assert.deepEqual(fake.calls, ["create:second", "handoff:t1:bo"]);
  const one = await client.callTool({ name: "get_task", arguments: { id: "t1" } });
  assert.match(JSON.stringify(one.content), /bo/);
});

test("client errors become isError results; bad input is rejected", async () => {
  const { client } = await connect();
  const res = await client.callTool({ name: "get_task", arguments: { id: "nope" } });
  assert.equal(res.isError, true);
  const bad = await client.callTool({ name: "create_task", arguments: {} }).catch((e) => e);
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
  await c.listTasks();
  await c.handOffTask({ id: "a/b", to: "z" });
  await c.approvePlan("r1");
  await c.steer({ id: "r1", message: "m" });
  await c.queueFollowup({ id: "r1", message: "m" });
  await c.retry("r1");
  await c.listEvents("r1");
  await c.spend();
  await c.listRepos();
  await c.getMetrics();
  assert.deepEqual(seen.map((s) => [s.method, s.url, s.auth]), [
    ["GET", "http://x/tasks", "Bearer tok"],
    ["POST", "http://x/tasks/a%2Fb/hand-off", "Bearer tok"],
    ["POST", "http://x/runs/r1/approve", "Bearer tok"],
    ["POST", "http://x/runs/r1/steer", "Bearer tok"],
    ["POST", "http://x/runs/r1/queue", "Bearer tok"],
    ["POST", "http://x/runs/r1/retry", "Bearer tok"],
    ["GET", "http://x/runs/r1/events", "Bearer tok"],
    ["GET", "http://x/spend", "Bearer tok"],
    ["GET", "http://x/repos", "Bearer tok"],
    ["GET", "http://x/api/metrics", "Bearer tok"],
  ]);
  const bad = createHttpClient("http://x", "t", async () => new Response("", { status: 500 }));
  await assert.rejects(bad.listTasks(), /500/);
});
