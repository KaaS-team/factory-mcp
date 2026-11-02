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
  listTasks: [],
  getTask: ["ID"],
  createTask: [{ title: "t" }],
  handOffTask: [{ id: "ID", to: "z" }],
  approvePlan: ["ID"],
  steer: [{ id: "ID", message: "m" }],
  queueFollowup: [{ id: "ID", message: "m" }],
  retry: ["ID"],
  listEvents: ["ID"],
  spend: [],
  listRepos: [],
  getMetrics: [],
};

/** Calls the client makes today that match no server route. */
const KNOWN_DRIFT: (Route & { reason: string })[] = [
  { method: "GET", path: "/tasks", reason: "server has no task routes" },
  { method: "GET", path: "/tasks/ID", reason: "server has no task routes" },
  { method: "POST", path: "/tasks", reason: "server has no task routes" },
  { method: "POST", path: "/tasks/ID/hand-off", reason: "server has no task routes" },
  { method: "POST", path: "/runs/ID/approve", reason: "server has no run approve route" },
  { method: "POST", path: "/runs/ID/steer", reason: "server has no run steer route" },
  { method: "POST", path: "/runs/ID/queue", reason: "server has no run queue route" },
  { method: "POST", path: "/runs/ID/retry", reason: "server has no run retry route" },
  { method: "GET", path: "/runs/ID/events", reason: "server has /api/runs/{repo}/{issue}/events" },
  { method: "GET", path: "/spend", reason: "server has /api/spend" },
  { method: "GET", path: "/repos", reason: "server has /api/repos" },
  { method: "GET", path: "/plugins", reason: "server has no plugins route" },
];

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

test("contract: every client call matches a server route or is in KNOWN_DRIFT", async () => {
  const calls = await recordCalls();
  for (const c of calls) {
    const drift = KNOWN_DRIFT.some((d) => d.method === c.method && d.path === c.path);
    assert.ok(
      onServer(c.method, c.path) || drift,
      `${c.via}: ${c.method} ${c.path} is neither a server route nor in KNOWN_DRIFT`,
    );
  }
});

test("contract: no KNOWN_DRIFT entry matches a server route", () => {
  for (const d of KNOWN_DRIFT) {
    assert.ok(!onServer(d.method, d.path), `KNOWN_DRIFT ${d.method} ${d.path} now matches a server route; remove it`);
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
