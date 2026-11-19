# x-factory-mcp report

## 1. Demo commands
```
git clone --depth 1 --branch next https://github.com/KaaS-team/KaaS-factory /tmp/f
grep -n 'Name: "' /tmp/f/internal/mcp/mcp.go
cat PARITY.md README.md
```
Output: the Go `factory mcp` server registers all 12 old tool names or a mapped tool; `tsTools` in `internal/mcp/mcp_test.go` records the mapping.

## 2. Acceptance
- PARITY.md lists every feature with a verdict and a path on `next`: done (21 rows; paths checked against `next` at `ad206c6`). Row 21 has no path because the repo has no workflows.
- README.md is the pointer; no other file changed: done (also added this report, as the brief requires).

## 3. Upstreams copied
None. Nothing copied.

## 4. Files outside my area / workflow changes
None.

## Tickets for the factory
- **get_metrics missing.** Problem: the old `get_metrics` tool returned factory metrics. The Go `status` tool shows the board only, so an MCP client cannot read metrics. Acceptance: an MCP tool (or a documented `status` field) returns the factory metrics, a value not reported is absent not zero, and a test in `internal/mcp/mcp_test.go` covers it.
