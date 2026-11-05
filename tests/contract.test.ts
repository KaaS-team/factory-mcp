import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHttpClient } from "../src/http-client.js";

interface Route {
  method: string;
  path: string;
}

const fixture = JSON.parse(
  readFileSync(new URL("../../tests/fixtures/factory-routes.json", import.meta.url), "utf8"),
) as { source: string; routes: Route[] };

/** Arguments for each client method. A method with no entry fails the test. */
const SAMPLES: Record<string, unknown[]> = {
  listRepos: [],
  listRuns: [],
  getRun: [{ repo: "R", issue: "ID" }],
  listEvents: [{ repo: "R", issue: "ID" }],
  spend: [],
  getMetrics: [],
  watchEvents: [{ seconds: 1, maxEvents: 1 }],
};

function matcher(path: string): RegExp {
  const src = path
    .split("/")
    .map((seg) => (/^\{.+\}$/.test(seg) ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${src}$`);
}

const matchers = fixture.routes.map((r) => ({ method: r.method, re: matcher(r.path) }));
const onServer = (method: string, path: string) =>
  matchers.some((m) => m.method === method && m.re.test(path));

async function recordCalls(): Promise<{ method: string; path: string; via: string }[]> {
  const calls: { method: string; path: string; via: string }[] = [];
  let current = "";
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ method: init?.method ?? "GET", path: new URL(String(url)).pathname, via: current });
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const client = createHttpClient("http://x", "tok", fetchImpl) as unknown as Record<
    string,
    (...a: unknown[]) => Promise<unknown>
  >;
  for (const name of Object.keys(client)) {
    const args = SAMPLES[name];
    assert.ok(args, `client method ${name} has no entry in SAMPLES`);
    current = name;
    await client[name](...args);
  }
  return calls;
}

test("contract: every client call matches a server route", async () => {
  const calls = await recordCalls();
  assert.ok(calls.length >= Object.keys(SAMPLES).length);
  for (const c of calls) {
    assert.ok(onServer(c.method, c.path), `${c.via}: ${c.method} ${c.path} is not a server route`);
  }
});

const liveUrl = process.env.FACTORY_SERVE_URL;
const liveToken = process.env.FACTORY_API_TOKEN;

test(
  "contract: live GET routes without parameters return 200",
  { skip: !liveUrl || !liveToken ? "FACTORY_SERVE_URL and FACTORY_API_TOKEN not set" : false },
  async () => {
    const base = (liveUrl ?? "").replace(/\/+$/, "");
    for (const r of fixture.routes.filter((x) => x.method === "GET" && !x.path.includes("{"))) {
      const res = await fetch(`${base}${r.path}`, { headers: { authorization: `Bearer ${liveToken}` } });
      assert.equal(res.status, 200, `GET ${r.path}`);
    }
  },
);
