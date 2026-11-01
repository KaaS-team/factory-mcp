import type { FactoryClient, Task } from "../src/client.js";

/** In-memory fake; no network. */
export function fakeClient(): FactoryClient & { calls: string[] } {
  const tasks: Task[] = [{ id: "t1", title: "first", status: "running", assignee: "ana" }];
  const calls: string[] = [];
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
  };
}
