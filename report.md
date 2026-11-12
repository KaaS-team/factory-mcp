BRANCH: cluster/docs
HEAD: 4b4b8687ef3637689817a5b1aac2cd0855865817
## Summary
The README was a "nothing installable yet" stub; it now describes the working server, its install, first command, tools and gate, and says plainly it targets the old Bun/TS factory routes. A docs check (links in every markdown file, README sh-block commands) is wired into `npm run check`.
## Acceptance
- Inventory (only markdown file is README.md; commands run from a fresh `npm ci`): `npm ci` works; `npm run build` works; `node dist/bin/factory-mcp.js` works (prints the env error, exit 1); stdio with env works (initialize and tools/list returned 12 tools); `--http --port 8765` works (prints listening line); `--http` without port works (prints usage error); `npm run check` works; old README claims "nothing installable, starts after the API lands" removed as stale; link to KaaS-factory and kaas.team kept (https, not checked offline) -> tests/docs.test.ts -> done
- README layout, two-sentence opening, install, first command with real output, next steps, 78 lines, no em dashes -> already checked by hand -> done
- Stale content gone: "in development / nothing installable / What it will be" section removed -> done
- Docs check in the gate; broke the link src/tools.ts once, test failed, restored -> tests/docs.test.ts (4 tests, 3 on temp fixtures) -> done
- No gate / make check: repo already has `npm run check` (typecheck, build, tests); no Makefile added -> already held
- Gate passes from clean clone -> npm run check -> done
## Files outside my area
none (README.md, tests/docs-check.ts, tests/docs.test.ts; package.json unchanged because the existing `test` glob picks up the new test)
## Goldens changed
none
## Gate evidence
```
ℹ tests 26
ℹ suites 0
ℹ pass 25
ℹ fail 0
ℹ cancelled 0
ℹ skipped 1
ℹ todo 0
ℹ duration_ms 476.461108
```
(the 1 skipped test existed before this change)
## Learnings
- The Go factory README does not document `factory mcp` or these HTTP routes, so compatibility with v9 could not be verified; the README says so. Briefs should name where the v9 API is documented.
- Only one markdown file existed, so the inventory was short; the check still walks every *.md for future docs.
