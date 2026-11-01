import { z } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { FactoryClient } from "./client.js";

export interface ToolDef {
  name: string;
  /** Protocol route id this tool maps to. */
  route: string;
  description: string;
  annotations: Required<Pick<ToolAnnotations, "readOnlyHint" | "destructiveHint" | "idempotentHint" | "openWorldHint">>;
  input: z.ZodRawShape;
  call(client: FactoryClient, args: Record<string, unknown>): Promise<unknown>;
}

const idShape = { id: z.string().min(1).describe("Task id") };
const messageShape = { ...idShape, message: z.string().min(1).describe("Message text") };

type Ann = ToolDef["annotations"];
const READ: Ann = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const WRITE: Ann = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

export const TOOLS: ToolDef[] = [
  {
    name: "list_tasks",
    route: "runs.list",
    description: "List all tasks the factory knows about. Read-only.",
    annotations: READ,
    input: {},
    call: (c) => c.listTasks(),
  },
  {
    name: "get_task",
    route: "runs.get",
    description: "Read one task by id. Read-only.",
    annotations: READ,
    input: idShape,
    call: (c, a) => c.getTask(a.id as string),
  },
  {
    name: "create_task",
    route: "tasks.create",
    description:
      "Create a new task. Each call creates another task, so repeating it makes duplicates. Never removes or changes existing tasks.",
    annotations: WRITE,
    input: {
      title: z.string().min(1).describe("Short task title"),
      body: z.string().optional().describe("Longer description"),
    },
    call: (c, a) => c.createTask({ title: a.title as string, body: a.body as string | undefined }),
  },
  {
    name: "hand_off_task",
    route: "tasks.hand_off",
    description:
      "Hand a task to another assignee. This replaces the current assignee, so the previous owner loses it. Repeating the same hand-off leaves the same end state.",
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    input: {
      ...idShape,
      to: z.string().min(1).describe("New assignee"),
      note: z.string().optional().describe("Context for the new assignee"),
    },
    call: (c, a) =>
      c.handOffTask({ id: a.id as string, to: a.to as string, note: a.note as string | undefined }),
  },
  {
    name: "approve_plan",
    route: "runs.approve",
    description:
      "Approve the pending plan of a run so it can continue. Changes the run state; the factory decides what happens on a repeat call.",
    annotations: WRITE,
    input: idShape,
    call: (c, a) => c.approvePlan(a.id as string),
  },
  {
    name: "steer",
    route: "runs.steer",
    description:
      "Send a steering message to a run. Each call sends another message. Does not remove or edit earlier ones.",
    annotations: WRITE,
    input: messageShape,
    call: (c, a) => c.steer({ id: a.id as string, message: a.message as string }),
  },
  {
    name: "queue_followup",
    route: "runs.queue",
    description:
      "Queue a follow-up message for a run. Each call queues another message. Does not remove or edit earlier ones.",
    annotations: WRITE,
    input: messageShape,
    call: (c, a) => c.queueFollowup({ id: a.id as string, message: a.message as string }),
  },
  {
    name: "retry",
    route: "runs.retry",
    description: "Ask the factory to retry a run. Each call is a new request; the factory decides what a retry does.",
    annotations: WRITE,
    input: idShape,
    call: (c, a) => c.retry(a.id as string),
  },
  {
    name: "list_events",
    route: "runs.events",
    description: "List the events of one run, as the factory returns them. Read-only.",
    annotations: READ,
    input: idShape,
    call: (c, a) => c.listEvents(a.id as string),
  },
  {
    name: "spend",
    route: "spend.get",
    description: "Read the spend report, exactly as the factory returns it for this token. Read-only.",
    annotations: READ,
    input: {},
    call: (c) => c.spend(),
  },
  {
    name: "list_repos",
    route: "repos.list",
    description: "List the repositories the factory knows about. Read-only.",
    annotations: READ,
    input: {},
    call: (c) => c.listRepos(),
  },
  {
    name: "list_plugins",
    route: "plugins.list",
    description: "List the plugins the factory reports. Read-only.",
    annotations: READ,
    input: {},
    call: (c) => c.listPlugins(),
  },
];
