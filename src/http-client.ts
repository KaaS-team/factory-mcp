import type { FactoryClient, RunRef } from "./client.js";

type Fetch = typeof fetch;

const seg = encodeURIComponent;
const runPath = ({ repo, issue }: RunRef) => `/api/runs/${seg(repo)}/${seg(issue)}`;

/** Parse one server-sent-events block into its data payload, or undefined. */
function parseBlock(block: string): unknown {
  const data = block
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).replace(/^ /, ""))
    .join("\n");
  if (!data) return undefined;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

/** FactoryClient over HTTP + bearer token. fetch is injectable for tests. */
export function createHttpClient(baseUrl: string, token: string, fetchImpl: Fetch = fetch): FactoryClient {
  const base = baseUrl.replace(/\/+$/, "");
  const headers = { authorization: `Bearer ${token}` };
  async function get<T>(path: string): Promise<T> {
    const res = await fetchImpl(`${base}${path}`, { method: "GET", headers });
    if (!res.ok) throw new Error(`factory GET ${path} failed: ${res.status}`);
    return (await res.json()) as T;
  }
  return {
    listRepos: () => get<unknown>("/api/repos"),
    listRuns: () => get<unknown>("/api/runs"),
    getRun: (ref) => get<unknown>(runPath(ref)),
    listEvents: (ref) => get<unknown>(`${runPath(ref)}/events`),
    spend: () => get<unknown>("/api/spend"),
    getMetrics: () => get<unknown>("/api/metrics"),
    async watchEvents({ seconds, maxEvents }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), seconds * 1000);
      const events: unknown[] = [];
      try {
        const res = await fetchImpl(`${base}/api/events`, {
          method: "GET",
          headers: { ...headers, accept: "text/event-stream" },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`factory GET /api/events failed: ${res.status}`);
        if (!res.body) return events;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (events.length < maxEvents) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          let i: number;
          while ((i = buf.indexOf("\n\n")) >= 0 && events.length < maxEvents) {
            const ev = parseBlock(buf.slice(0, i));
            buf = buf.slice(i + 2);
            if (ev !== undefined) events.push(ev);
          }
        }
        await reader.cancel().catch(() => {});
      } catch (err) {
        // The time budget ending is the normal way a watch stops.
        if (!controller.signal.aborted) throw err;
      } finally {
        clearTimeout(timer);
        controller.abort();
      }
      return events;
    },
  };
}
