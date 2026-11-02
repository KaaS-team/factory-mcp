import type { FactoryClient, Task } from "../src/client.js";

/** In-memory fake; no network. */
export const FAKE_SPEND = { tokens: 1200, runs: 3 };

export function fakeClient(): FactoryClient & { calls: string[] } {
  const tasks: Task[] = [{ id: "t1", title: "first", status: "running", assignee: "ana" }];
  const calls: string[] = [];
  const events: { run: string; kind: string; text?: string }[] = [];
  const known = (id: string) => {
    if (!tasks.some((x) => x.id === id)) throw new Error(`no task ${id}`);
  };
  return {
    calls,
    async listTasks() { calls.push("list"); return tasks; },
    async getTask(id) {
      calls.push(`get:${id}`);
      const t = tasks.find((x) => x.id === id);
      if (!t) throw new Error(`no task ${id}`);
      return t;
    },
    async createTask(input) {
      calls.push(`create:${input.title}`);
      const t = { id: `t${tasks.length + 1}`, title: input.title, status: "queued" };
      tasks.push(t);
      return t;
    },
    async handOffTask({ id, to }) {
      calls.push(`handoff:${id}:${to}`);
      const t = tasks.find((x) => x.id === id);
      if (!t) throw new Error(`no task ${id}`);
      t.assignee = to;
      return t;
    },
    async approvePlan(id) {
      calls.push(`approve:${id}`);
      known(id);
      events.push({ run: id, kind: "approved" });
      return { id, approved: true };
    },
    async steer({ id, message }) {
      calls.push(`steer:${id}:${message}`);
      known(id);
      events.push({ run: id, kind: "steer", text: message });
      return { id, accepted: true };
    },
    async queueFollowup({ id, message }) {
      calls.push(`queue:${id}:${message}`);
      known(id);
      events.push({ run: id, kind: "queued", text: message });
      return { id, queued: true };
    },
    async retry(id) {
      calls.push(`retry:${id}`);
      known(id);
      events.push({ run: id, kind: "retry" });
      return { id, retried: true };
    },
    async listEvents(id) {
      calls.push(`events:${id}`);
      known(id);
      return events.filter((e) => e.run === id);
    },
    async spend() { calls.push("spend"); return FAKE_SPEND; },
    async listRepos() { calls.push("repos"); return [{ name: "factory-mcp" }]; },
    async getMetrics() { calls.push("metrics"); return { runs_total: 0 }; },
  };
}
