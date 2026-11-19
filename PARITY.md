# Parity with the Go factory

factory-mcp is archived. The Go factory replaces it. Paths below are in
[KaaS-team/factory](https://github.com/KaaS-team/factory) branch `next`
(checked at `ad206c6`; the repo is moving to KaaS-team/factory).

Verdicts: **covered**, **dropped on purpose**, **missing**.

| # | Feature here | Verdict | Where on `next` |
| --- | --- | --- | --- |
| 1 | Tool `list_tasks` | covered | `internal/mcp/mcp.go` (`list_tickets`); mapping tested in `internal/mcp/mcp_test.go` (`tsTools`) |
| 2 | Tool `get_task` | covered | `internal/mcp/mcp.go` (`status` with a ticket) |
| 3 | Tool `create_task` | covered | `internal/mcp/mcp.go` (`create_task`, same name and text) |
| 4 | Tool `hand_off_task` | covered | `internal/mcp/mcp.go` (`hand_off_task`) |
| 5 | Tool `approve_plan` | covered | `internal/mcp/mcp.go` (`approve_plan`), wired in `cmd/factory/main.go` |
| 6 | Tool `steer` | covered | `internal/mcp/mcp.go` (`steer`) |
| 7 | Tool `queue_followup` | covered | `internal/mcp/mcp.go` (`queue_followup`) |
| 8 | Tool `retry` | covered | `internal/mcp/mcp.go` (`retry`) |
| 9 | Tool `list_events` | covered | `internal/mcp/mcp.go` (`list_events`) |
| 10 | Tool `list_repos` | covered | `internal/mcp/mcp.go` (`list_repos`) |
| 11 | Tool `spend` | covered, partly | `internal/mcp/mcp.go` (`report` tool); CLI `factory report` in `internal/report/command.go`. Cost data is in `internal/api/api.go` (`CostUSD`). No per-token spend view |
| 12 | Tool `get_metrics` | missing | The Go `status` tool shows the board only. No metrics tool or route found |
| 13 | Read-only and write tool hints | covered | `internal/mcp/mcp.go` (read and write hints), plus `--read-only` flag |
| 14 | Stdio transport | covered | `factory mcp`, `internal/mcp/mcp.go`, `docs/cli-reference.md` |
| 15 | Streamable HTTP at `/mcp`, loopback, bearer token (`--http --port`) | covered | `factory mcp --http`, token in `FACTORY_MCP_TOKEN`, `internal/mcp/mcp.go`; test `TestHTTPAuthAndPaths` |
| 16 | Config keys `FACTORY_URL`, `FACTORY_API_TOKEN` | dropped on purpose | The Go server runs inside the factory and needs no URL or API token. Only `FACTORY_MCP_TOKEN` for HTTP |
| 17 | HTTP client to the factory REST routes (`src/http-client.ts`) | dropped on purpose | The Go tools call the control plane in process (`cmd/factory/main.go`, `mcpHandlers`) |
| 18 | Contract test and route fixture (`tests/contract.test.ts`, `tests/fixtures/factory-routes.json`) | dropped on purpose | No REST hop left to check. `TestEveryTSToolIsServed` in `internal/mcp/mcp_test.go` guards the tool names |
| 19 | Docs check (relative links, `sh` block commands; `tests/docs-check.ts`) | dropped on purpose | Docs are generated and checked in `cmd/factory/clidoc_test.go` |
| 20 | Scripts `build`, `typecheck`, `test`, `check`, `.gitignore`, `LICENSE` | dropped on purpose | Node project. The factory uses `gate.sh` and `Makefile` |
| 21 | Workflows | none | This repo has no `.github/workflows` |

## Missing

Row 12 is the only missing row. Its ticket is in the report `.factory/reports/x-factory-mcp.md`.
