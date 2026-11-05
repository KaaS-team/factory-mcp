import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import { createHttpClient } from "../src/http-client.js";
import { TOOLS } from "../src/tools.js";

const fixture = JSON.parse(
  readFileSync(new URL("../../tests/fixtures/factory-routes.json", import.meta.url), "utf8"),
) as { routes: { method: string; path: string }[] };

const CANNED: Record<string, unknown> = {
  "/api/repos": [{ name: "factory-mcp" }],
  "/api/runs": [{ repo: "factory-mcp", issue: "1", status: "running" }],
  "/api/runs/factory-mcp/1": { repo: "factory-mcp", issue: "1", status: "running" },
  "/api/runs/factory-mcp/1/events": [{ kind: "started" }],
  "/api/spend": { runs: 1 },
  "/api/metrics": { runs_total: 1 },
};

async function withFactory<T>(fn: (url: string, seen: string[]) => Promise<T>): Promise<T> {
  const seen: string[] = [];
  const open: ServerResponse[] = [];
  const server = createServer((req, res) => {
    const path = req.url ?? "";
    seen.push(`${req.method} ${path} ${req.headers.authorization}`);
    if (req.headers.authorization !== "Bearer tok") return void res.writeHead(401).end();
    if (path === "/api/events") {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write('data: {"kind":"one"}\n\n');
      res.write('data: {"kind":"two"}\n\ndata: {"kind":"three"}\n\n');
      open.push(res); // stays open, like a live stream
      return;
    }
    if (req.method === "GET" && path in CANNED) {
      res.writeHead(200, { "content-type": "application/json" });
      return void res.end(JSON.stringify(CANNED[path]));
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    return await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen);
  } finally {
    for (const r of open) r.destroy();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
}

async function mcp(url: string, token = "tok") {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await buildServer(createHttpClient(url, token)).connect(a);
  const client = new Client({ name: "t", version: "0" });
  await client.connect(b);
  return client;
}

const body = (r: object) => JSON.parse(((r as { content: { text: string }[] }).content)[0]!.text);

test("real http: every tool runs through the real client against a local factory", async () => {
  await withFactory(async (url, seen) => {
    const client = await mcp(url);
    const args: Record<string, Record<string, unknown>> = {
      get_run: { repo: "factory-mcp", issue: "1" },
      list_events: { repo: "factory-mcp", issue: "1" },
      watch_events: { seconds: 1, max_events: 2 },
    };
    for (const t of TOOLS) {
      const res = await client.callTool({ name: t.name, arguments: args[t.name] ?? {} });
      assert.notEqual(res.isError, true, `${t.name}: ${JSON.stringify(res.content)}`);
      if (t.name === "watch_events") assert.deepEqual(body(res), [{ kind: "one" }, { kind: "two" }]);
      else if (t.name === "get_run") assert.deepEqual(body(res), CANNED["/api/runs/factory-mcp/1"]);
      else if (t.name === "list_events") assert.deepEqual(body(res), CANNED["/api/runs/factory-mcp/1/events"]);
      else if (t.name === "spend") assert.deepEqual(body(res), CANNED["/api/spend"]);
      else if (t.name === "get_metrics") assert.deepEqual(body(res), CANNED["/api/metrics"]);
      else if (t.name === "list_repos") assert.deepEqual(body(res), CANNED["/api/repos"]);
      else if (t.name === "list_runs") assert.deepEqual(body(res), CANNED["/api/runs"]);
    }
    assert.equal(seen.length, TOOLS.length);
    const routes = new Set(fixture.routes.map((r) => r.path.replace(/\{[^}]+\}/g, "[^/]+")));
    for (const s of seen) {
      const path = s.split(" ")[1]!;
      assert.ok([...routes].some((r) => new RegExp(`^${r}$`).test(path)), `${path} is a fixture route`);
    }
  });
});

test("real http: watch_events returns what arrived when the time limit ends", async () => {
  await withFactory(async (url) => {
    const client = await mcp(url);
    const started = Date.now();
    const res = await client.callTool({ name: "watch_events", arguments: { seconds: 1, max_events: 100 } });
    assert.deepEqual(body(res), [{ kind: "one" }, { kind: "two" }, { kind: "three" }]);
    assert.ok(Date.now() - started >= 900, "waited for the time limit");
  });
});

test("real http: a rejected token surfaces as an error result", async () => {
  await withFactory(async (url) => {
    const client = await mcp(url, "wrong");
    const res = await client.callTool({ name: "list_runs", arguments: {} });
    assert.equal(res.isError, true);
    assert.match(JSON.stringify(res.content), /401/);
  });
});
