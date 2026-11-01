import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { buildServer } from "../src/server.js";
import { startHttp } from "../src/http.js";
import { TOOLS } from "../src/tools.js";
import { fakeClient } from "./fake-client.js";

const TOKEN = "secret-token";
const INIT = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
};

test("http: no token or a wrong token gets 401; the right token is let through", async () => {
  const h = await startHttp(buildServer(fakeClient()), { port: 0, token: TOKEN });
  try {
    const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
    const none = await fetch(h.url, { method: "POST", headers, body: JSON.stringify(INIT) });
    assert.equal(none.status, 401);
    assert.equal(await none.text(), "unauthorized");
    const wrong = await fetch(h.url, { method: "POST", headers: { ...headers, authorization: "Bearer nope" }, body: JSON.stringify(INIT) });
    assert.equal(wrong.status, 401);
    const basic = await fetch(h.url, { method: "POST", headers: { ...headers, authorization: TOKEN }, body: JSON.stringify(INIT) });
    assert.equal(basic.status, 401);
    const ok = await fetch(h.url, { method: "POST", headers: { ...headers, authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(INIT) });
    assert.equal(ok.status, 200);
    await ok.body?.cancel();
  } finally {
    await h.close();
  }
});

test("http: with the token, tools/list answers every tool and a tool call works", async () => {
  const h = await startHttp(buildServer(fakeClient()), { port: 0, token: TOKEN });
  const client = new Client({ name: "t", version: "0" });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(h.url), { requestInit: { headers: { authorization: `Bearer ${TOKEN}` } } }),
    );
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), TOOLS.map((t) => t.name).sort());
    const res = await client.callTool({ name: "list_tasks", arguments: {} });
    assert.match(JSON.stringify(res.content), /first/);
  } finally {
    await client.close();
    await h.close();
  }
});

test("http: an empty token is refused at startup", async () => {
  await assert.rejects(startHttp(buildServer(fakeClient()), { port: 0, token: "" }), /token/);
});

test("http: the bearer check is the single line in src/http.ts", () => {
  const src = readFileSync(new URL("../../src/http.ts", import.meta.url), "utf8");
  const line =
    'if (req.headers.get("authorization") !== `Bearer ${token}`) return new Response("unauthorized", { status: 401 });';
  assert.equal(src.split("\n").filter((l) => l.trim() === line).length, 1);
});

test("bin reads credentials from env only and offers --http --port", () => {
  const bin = readFileSync(new URL("../../bin/factory-mcp.ts", import.meta.url), "utf8");
  assert.match(bin, /process\.env\.FACTORY_URL/);
  assert.match(bin, /process\.env\.FACTORY_API_TOKEN/);
  assert.match(bin, /--http/);
  assert.match(bin, /--port/);
  assert.doesNotMatch(bin, /argv[^\n]*(token|TOKEN)/);
});
