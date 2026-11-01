import { z } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { FactoryClient } from "./client.js";

export interface ToolDef {
  name: string;
  description: string;
  annotations: Required<Pick<ToolAnnotations, "readOnlyHint" | "destructiveHint" | "idempotentHint" | "openWorldHint">>;
  input: z.ZodRawShape;
  call(client: FactoryClient, args: Record<string, unknown>): Promise<unknown>;
}

const idShape = { id: z.string().min(1).describe("Task id") };

export const TOOLS: ToolDef[] = [
  {
    name: "list_tasks",
    description: "List all tasks the factory knows about. Read-only.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    input: {},
    call: (c) => c.listTasks(),
  },
  {
    name: "get_task",
    description: "Read one task by id. Read-only.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    input: idShape,
    call: (c, a) => c.getTask(a.id as string),
  },
  {
    name: "create_task",
    description:
      "Create a new task. Each call creates another task, so repeating it makes duplicates. Never removes or changes existing tasks.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    input: {
      title: z.string().min(1).describe("Short task title"),
      body: z.string().optional().describe("Longer description"),
    },
    call: (c, a) => c.createTask({ title: a.title as string, body: a.body as string | undefined }),
  },
  {
    name: "hand_off_task",
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
];
