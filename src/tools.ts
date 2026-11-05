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

const runShape = {
  repo: z.string().min(1).describe("Repository name, as list_repos returns it"),
  issue: z.string().min(1).describe("Issue number of the run"),
};

type Ann = ToolDef["annotations"];
const READ: Ann = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export const TOOLS: ToolDef[] = [
  {
    name: "list_repos",
    route: "repos.list",
    description: "List the repositories the factory knows about. Read-only.",
    annotations: READ,
    input: {},
    call: (c) => c.listRepos(),
  },
  {
    name: "list_runs",
    route: "runs.list",
    description: "List the runs the factory knows about, as it returns them. Read-only.",
    annotations: READ,
    input: {},
    call: (c) => c.listRuns(),
  },
  {
    name: "get_run",
    route: "runs.get",
    description: "Read one run by repository and issue. Read-only.",
    annotations: READ,
    input: runShape,
    call: (c, a) => c.getRun({ repo: a.repo as string, issue: a.issue as string }),
  },
  {
    name: "list_events",
    route: "runs.events",
    description: "List the events of one run, as the factory returns them. Read-only.",
    annotations: READ,
    input: runShape,
    call: (c, a) => c.listEvents({ repo: a.repo as string, issue: a.issue as string }),
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
    name: "get_metrics",
    route: "metrics.get",
    description:
      "Read the factory metrics, exactly as the factory returns them. Read-only. A value the factory does not report is absent, never zero.",
    annotations: READ,
    input: {},
    call: (c) => c.getMetrics(),
  },
  {
    name: "watch_events",
    route: "events.watch",
    description:
      "Listen to the factory event stream for a bounded time and return the events that arrived, oldest first. Stops at the time limit or the event limit, whichever comes first. An empty list means nothing arrived. Read-only.",
    annotations: READ,
    input: {
      seconds: z.number().int().min(1).max(60).default(5).describe("How long to listen, 1 to 60 seconds"),
      max_events: z.number().int().min(1).max(1000).default(100).describe("Stop after this many events"),
    },
    call: (c, a) => c.watchEvents({ seconds: a.seconds as number, maxEvents: a.max_events as number }),
  },
];
