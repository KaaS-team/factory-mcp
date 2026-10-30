<!-- factory:planned v1 -->
Repo: KaaS-team/factory-mcp
Deps: none
Epic: E7 factory-mcp
Milestone: Phase 7 MCP
Runner: factory

## Why
An agent or IDE that wants to drive the factory today talks to `src/mcp-server.ts` inside the factory runner: a hand-rolled newline JSON-RPC loop with four tools that calls the tracker directly. It cannot run on a machine without the factory checkout, cannot speak HTTP, and does not see runs, events or spend. This epic (T11) makes `factory-mcp` a standalone package: ten tools on the official MCP SDK over stdio and streamable HTTP, built only on the protocol client, so it reads exactly what the TUI and the plane read and cannot reach factory internals.

## Today
- Factory repo `src/mcp-server.ts:10` speaks protocol `2025-06-18` by hand; its tools are `list_tasks` (`:45`), `read_task` (`:57`), `start_task` (`:73`) and `approve_plan` (`:89`), each calling the `ScmPort` directly. No `@modelcontextprotocol/sdk` dependency exists in the factory `package.json`.
- Factory repo `src/api/routes.ts` (from #195) declares `ROUTES` with read routes `repos.list`, `runs.list`, `runs.get`, `runs.events`, `spend.get` and the `stream` SSE route; #195's NG-3 leaves write routes out. #203 (steer and queue) and #204 (inbox approve) add the write routes the TUI uses; this plan assumes ids `runs.approve`, `runs.steer`, `runs.queue`, `runs.retry` and, from #193's registry, `plugins.list`.
- Factory repo `src/api/client.ts` (from #195) exports `createClient(baseUrl, token)` and `fakeClient(name)`; `factory serve --fixture two-repos --print-url` serves the seeded fixture. #196 publishes the client through `@kaas-team/factory-sdk`.
- This repo holds only `LICENSE` and `README.md` today. #200 (D8) fills it with the split history, CI and a `.factory` setup; this plan assumes the repo root then has `package.json`, `src/`, `tests/` and a `make check` gate. Until #200 merges, the factory cannot run here.

## Change
### T1: Tool table on the protocol client
Files: `src/tools.ts`, `tests/tools.test.ts`, `package.json`
Model: sonnet
1. Add `@modelcontextprotocol/sdk` pinned exactly at `1.32.2` to `package.json`, vetted with `/eng-add-dependency` (maintainer, age, licence noted in the PR body). Add `@kaas-team/factory-sdk` at the version #196 published.
2. Create `src/tools.ts` exporting `TOOLS`, one entry per tool: `{ name, description, input: JsonSchema, route: string, call(client, args) }`. The ten names are `list_tasks`, `get_task`, `approve_plan`, `steer`, `queue_followup`, `retry`, `list_events`, `spend`, `list_repos` and `list_plugins`, mapped to `runs.list`, `runs.get`, `runs.approve`, `runs.steer`, `runs.queue`, `runs.retry`, `runs.events`, `spend.get`, `repos.list` and `plugins.list`.
3. Each `call` uses only the client method for its route; `src/` must import nothing from the factory except `@kaas-team/factory-sdk`. The import check is a test, not a comment.
4. Tool results never carry a model name or a dollar sign: `spend` returns tokens and counts for a customer token and money only for an operator token, as the route already decides. The tools pass the route body through unchanged.

### T2: Server over stdio and streamable HTTP
Files: `src/server.ts`, `src/http.ts`, `bin/factory-mcp.ts`, `package.json`, `tests/server.test.ts`
Model: sonnet
Deps: T1
1. `src/server.ts` exports `buildServer(client)` that registers every `TOOLS` entry on an SDK `McpServer` with its input schema; an unknown tool is the SDK's own error.
2. `src/http.ts` exports `startHttp(server, { port, token })` on the SDK's streamable HTTP transport; a request without `Authorization: Bearer <token>` gets 401. The check must be written as exactly this line: `if (req.headers.get("authorization") !== \`Bearer ${token}\`) return new Response("unauthorized", { status: 401 });`
3. `bin/factory-mcp.ts` reads `FACTORY_URL` and `FACTORY_API_TOKEN` from the environment (never from argv), builds the client, and runs stdio by default or HTTP with `--http --port <n>`. Add it as the `bin` entry in `package.json`.

### T3: Contract test against factory serve
Files: `tests/contract.test.ts`, `tests/support/serve.ts`, `Makefile`
Model: sonnet
Deps: T2
1. `tests/support/serve.ts` starts the factory binary pinned in `package.json` (`factory serve --fixture two-repos --print-url --port 0`), reads the URL from stdout and stops it after the suite.
2. `tests/contract.test.ts` connects an SDK `Client` to `buildServer` over an in-memory transport pair, lists tools, and asserts exactly the ten names in `TOOLS` order.
3. It calls every tool against the served fixture and checks each result validates against the route's response schema from the protocol package: `list_tasks` returns three runs, `get_task` returns the running one, `approve_plan` on the awaiting run then shows it moved, `steer` and `queue_followup` each appear in `list_events`.
4. A tool whose route id is missing from `ROUTES` fails the suite with the missing id in the message.
5. Wire `tests/contract.test.ts` into `make check`; when the factory binary is absent the target fails with an install hint, it never skips silently.

## Tests
- `tests/tools.test.ts`: [permanent] `TOOLS` has the ten names and each `route` exists in the protocol `ROUTES`; no file under `src/` imports a path outside `@kaas-team/factory-sdk`, the SDK and node built-ins.
- `tests/server.test.ts`: [permanent] HTTP without a bearer token gets 401; with it, `tools/list` answers ten tools; stdio mode answers `initialize` with the server name.
- `tests/contract.test.ts`: [permanent] every tool answers a schema-valid body from `factory serve --fixture two-repos`, and a write tool's effect is visible to a read tool.

## Mutation
```json
{"name":"http: no token check","file":"src/http.ts","find":"if (req.headers.get(\"authorization\") !== `Bearer ${token}`) return new Response(\"unauthorized\", { status: 401 });","replace":"","test":"tests/server.test.ts"}
```
```json
{"name":"tools: drop retry","file":"src/tools.ts","find":"\"retry\"","replace":"\"retry_removed\"","test":"tests/tools.test.ts"}
```

## Acceptance
- AC-1: ten tools exist and each maps to a declared protocol route: checked by `bun test tests/tools.test.ts` (T1)
- AC-2: the package imports nothing from factory internals: checked by `bun test tests/tools.test.ts` (T1)
- AC-3: HTTP refuses a request without the bearer token and stdio answers initialize: checked by `bun test tests/server.test.ts` (T2)
- AC-4: every tool returns a schema-valid answer from factory serve with the two-repos fixture: checked by `bun test tests/contract.test.ts` (T3)
- AC-5: the contract test runs in the gate: checked by `make check` (T3)

## Non-goals
- NG-1: no new routes in the factory; missing write routes are #203 and #204 work and the contract test names them.
- NG-2: deleting the factory's own `src/mcp-server.ts` is a factory-repo follow-up once this package is published.
- NG-3: no npm publish workflow here; distribution follows #202's pattern in a later issue.
- NG-4: no MCP resources or prompts, tools only.

## Files
- `src/tools.ts` (new)
- `src/server.ts` (new)
- `src/http.ts` (new)
- `bin/factory-mcp.ts` (new)
- `package.json`
- `Makefile`
- `tests/tools.test.ts` (new)
- `tests/server.test.ts` (new)
- `tests/contract.test.ts` (new)
- `tests/support/serve.ts` (new)

## Risk: medium
A new external dependency (`@modelcontextprotocol/sdk` 1.32.2) on a package agents run with write tools; it is pinned exactly and vetted. Write tools go through the same token-gated routes the TUI uses, so the package adds no new authority. The contract test needs a factory binary; a version skew shows up as a named route failure, not a silent pass. Rollback: revert the PR; nothing else depends on this package yet.
## Model: sonnet

