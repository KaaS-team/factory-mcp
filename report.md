BRANCH: cluster/mcp-v0.1-server
HEAD: 779e1a43c0a5628171bb48c87e67758d85df3cd4
## Summary
Seven read tools ship, each backed by a route in tests/fixtures/factory-routes.json: list_repos, list_runs, get_run, list_events, spend, get_metrics, watch_events. Three of the ten (approve_plan, steer, retry) follow once the factory routes exist. This run does not claim ten.
## Issues
- #1: partly done (7 of 10 tools, per the supervisor decision).
  - Standalone package on the official SDK over stdio and streamable HTTP -> already held on base (tests/http.test.ts "http: with the token, tools/list answers every tool and a tool call works"); no mutation file, repo has no tests/mutations.
  - Ten tools -> NOT met: seven ship. Test pinning the list: "the shipped tool list is exactly the seven read tools" (tests/tools.test.ts).
  - Built only on the protocol client, cannot reach factory internals -> "src imports only the SDK, zod, node builtins and files under src/" (tests/tools.test.ts); "contract: every client call matches a server route" (KNOWN_DRIFT deleted).
  - Test drives each tool against a protocol server -> "real http: every tool runs through the real client against a local factory", plus the watch time-limit and 401 tests (tests/real-http.test.ts).
  - Mutation: changed /api/spend to /spend in src/http-client.ts once; 3 tests failed (contract, real http, fake-fetch route map). Reverted.
## Staged workflow changes
none
## Files outside my area
none changed. README.md line 9 still says "approve a gate"; it is stale and the supervisor should reword it.
## Gate evidence
ℹ pass 20 / ℹ fail 0 (npm run check; 1 skipped live-route test needing FACTORY_SERVE_URL)
## Risk and rollback
watch_events parses server-sent events with a simple "data:" reader and assumes the stream's event format; no real factory was run. Roll back by reverting commit 779e1a4.
## Learnings
- Brief names bun, make, biome, --rerun-each and tests/mutations; none exist here. The gate is npm run check. Defaults should describe the repo's real tooling.
- I ran `git checkout src/http-client.ts` to undo a mutation and lost my uncommitted rewrite; commit before mutating, or use git stash. Rewrote it.
- Not run: the three-times rerun, since --rerun-each does not exist; I ran the built tests three times by hand, all passed.
- Brief mentions AGENTS.md and ci/; neither exists in this repo.
