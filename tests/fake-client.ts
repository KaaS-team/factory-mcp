import type { FactoryClient } from "../src/client.js";

/** In-memory fake; no network. */
export const FAKE_SPEND = { runs: 3, total: 12 };

export function fakeClient(): FactoryClient & { calls: string[] } {
  const calls: string[] = [];
  const known = (repo: string, issue: string) => {
    if (repo !== "factory-mcp" || issue !== "1") throw new Error(`no run ${repo}#${issue}`);
  };
  return {
    calls,
    async listRepos() { calls.push("repos"); return [{ name: "factory-mcp" }]; },
    async listRuns() { calls.push("runs"); return [{ repo: "factory-mcp", issue: "1", status: "running" }]; },
    async getRun({ repo, issue }) {
      calls.push(`run:${repo}:${issue}`);
      known(repo, issue);
      return { repo, issue, status: "running" };
    },
    async listEvents({ repo, issue }) {
      calls.push(`events:${repo}:${issue}`);
      known(repo, issue);
      return [{ kind: "started" }];
    },
    async spend() { calls.push("spend"); return FAKE_SPEND; },
    async getMetrics() { calls.push("metrics"); return { runs_total: 0 }; },
    async watchEvents({ seconds, maxEvents }) {
      calls.push(`watch:${seconds}:${maxEvents}`);
      return [{ kind: "tick" }];
    },
  };
}
