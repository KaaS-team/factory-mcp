# factory-mcp

An MCP server that lets an MCP client list, create, hand off and steer tasks and runs in a KaaS Factory. It is for people who run a factory and want to drive it from an MCP client such as an editor or chat assistant.

It is a thin layer over the factory's HTTP API. It adds no behaviour of its own: each tool is one factory request, and the reply is passed back as the factory sent it.

**Which factory.** The routes this server calls (`/tasks`, `/runs/<id>/...`, `/spend`, `/repos`, `/api/metrics`) were written against the earlier Bun/TypeScript factory. It has not been checked against the Go rewrite on the `next` branch of [KaaS-factory](https://github.com/KaaS-team/KaaS-factory).

The package is private and not published. You run it from a clone.

## Install

You need Node 20 or newer.

```sh
git clone https://github.com/KaaS-team/factory-mcp.git
cd factory-mcp
npm ci
npm run build
```

## First command

The server reads the factory address and token from the environment, never from arguments. With neither set it says so and exits with status 1:

```sh
node dist/bin/factory-mcp.js
```

```
factory-mcp: set FACTORY_URL and FACTORY_API_TOKEN
```

Set both and it serves MCP over stdio, which is how most clients start it:

```sh
FACTORY_URL=http://127.0.0.1:4100 FACTORY_API_TOKEN=<token> node dist/bin/factory-mcp.js
```

To serve streamable HTTP instead, add `--http --port <n>`. It binds 127.0.0.1 only, serves `/mcp`, and requires the same token as a bearer token:

```sh
FACTORY_URL=http://127.0.0.1:4100 FACTORY_API_TOKEN=<token> node dist/bin/factory-mcp.js --http --port 8765
```

```
factory-mcp: listening on http://127.0.0.1:8765/mcp
```

## Tools

| Tool | What it asks the factory | Read-only |
| --- | --- | --- |
| `list_tasks` | all tasks | yes |
| `get_task` | one task by id | yes |
| `create_task` | create a task | no |
| `hand_off_task` | hand a task to the factory | no |
| `approve_plan` | approve a run's plan | no |
| `steer` | send a message to a run | no |
| `queue_followup` | queue a message for a run | no |
| `retry` | ask for a retry of a run | no |
| `list_events` | the events of one run | yes |
| `spend` | the spend report for this token | yes |
| `list_repos` | the repositories the factory knows | yes |
| `get_metrics` | the factory metrics | yes |

Input schemas and descriptions are in [src/tools.ts](src/tools.ts).

## Develop

```sh
npm run check
```

`check` runs the type check, the build and the tests. The tests use fakes and fixtures and make no network calls. They include a docs check: every relative link in every markdown file must point to a file that exists, and every `npm run` script, Make target or file named in a `sh` block of this README must exist. The code for it is in [tests/docs-check.ts](tests/docs-check.ts).

## Part of KaaS

This repo belongs to [KaaS Factory](https://github.com/KaaS-team/KaaS-factory), the open-source software factory that turns tracker issues into reviewed, gated pull requests. More at [kaas.team](https://kaas.team).

Licensed Apache-2.0 ([LICENSE](LICENSE)). Contributions are signed off under the DCO.
