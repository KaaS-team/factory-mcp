You are one of ten agents working in parallel, one per repo. You work alone in KaaS-team/factory-mcp.

## Why

The owner says most docs, the README included, are hard to read and partly stale. A reader must be able to follow every doc from a clean clone and have it work. This repo: MCP server for the factory (TypeScript). Gate: the `check` or `test` script in package.json; add `make check` or a `check` script if none runs build plus tests.

The factory is being rewritten in Go (`KaaS-team/KaaS-factory`, branch `next`): one static binary `factory`, installed by `brew install kaas-team/tap/factory` or `install.sh`, with commands `init`, `first-run`, `doctor`, `plan`, `run`, `status`, `logs`, `add`, `packs`, `eval`, `report`, `config`, `mcp`, `dashboard`. Read `git show origin/next:README.md` there (clone it read-only to /tmp if needed) and describe the factory only in ways that match it. Where this repo still targets the old Bun/TS factory, say so plainly in one line rather than inventing v9 behaviour.

## Setup

`git fetch origin && git checkout -b cluster/docs origin/main`. Your file area: every `*.md` file, `docs/`, the gate file (Makefile or package.json scripts), and one new docs check under `scripts/` or `tests/`. Code only where a documented command is broken and the fix is small; otherwise fix the doc.

## Acceptance

- [ ] Inventory: list every markdown file and every command, flag, path and link it states. Run each command from a clean clone (no network beyond `git` and the package manager's lockfile install). Record each as works, fixed doc, fixed code, or removed (why).
- [ ] README opens with what the repo is for and who uses it in two plain sentences, then install, then a first command with its real output, then where to go next. No marketing, no em dashes, no claim the code does not do. Under 150 lines unless the content needs more.
- [ ] Stale content gone: references to removed files, renamed commands, old versions, or dead links are fixed or removed. Each removal is in the report.
- [ ] A docs check wired into the gate (Rule 0): it fails when a relative link in any markdown file points to a missing file, and when a fenced `sh`/`bash` block in README names a script or Make target that does not exist. Prove it bites by breaking one link once.
- [ ] If the repo has no gate, add `make check` running the docs check (and any existing tests), and say so in the README.
- [ ] The repo's own gate passes from a clean clone. If it fails for reasons outside docs, fix it when small, else record it blocked with the failing output.

## Order of work, for each acceptance line

1. Check whether it already holds. If it does, change no code and record the evidence.
2. Write a test that fails, then the code that makes it pass. Revert the fix once and watch the test fail.
3. Run the repo's gate (`make check`) before every push. Commit with `git commit -s`, one commit per acceptance group, and push after each so a dropped session loses little.

## Checkpoints, before every commit

1. Area: every changed file is in your area or listed under "Files outside my area".
2. Scope: the diff serves only an acceptance line below.
3. Meaning: each acceptance line still means what it says; if it cannot be met, record it blocked, never weaken it.
4. Proof: you saw each new test fail before the fix and pass after.
5. Pins: you raised no cap, baseline or golden just to make a test pass; any golden you update is named in the report with the reason.
6. Forbidden paths: nothing under `.github/`, `.factory/`, `.claude/`, `.agents/`; no version or changelog edit.

## Rules

- No network, real token or model call in any test. Use fixtures and fake executables on `PATH`.
- No `ANTHROPIC_*` or other provider key anywhere.
- This repo may become public. Name no customer. No model name, token count or cost in customer-facing output except where an acceptance line asks for an estimate in the operator report.
- No em dashes in prose. Plain sentences. Never write a claim the code does not do.
- Do not comment on, label or close issues, and do not open a PR. Never force-push or push to `main`.
- No session URL, `claude.ai` link or `Claude-Session:` trailer in any commit or file.
- If one line is blocked, record why and continue.

## When you finish

Write the report below to a file outside the repo, then push it:

```
b=$(git hash-object -w /tmp/report.md); t=$(printf '100644 blob %s\treport.md\n' "$b" | git mktree); c=$(git commit-tree "$t" -m report); git push origin "$c:refs/heads/report/v9-factory-mcp-docs"
```

Your final message is that same report, exactly:

```
BRANCH: cluster/docs
HEAD: <full sha you pushed, checked with git ls-remote>
## Summary
<one or two sentences>
## Acceptance
- <line> -> <test name> -> done | already held | blocked (why)
## Files outside my area
<each, with why, or none>
## Goldens changed
<each, with why, or none>
## Gate evidence
<last lines of `make check`, verbatim>
## Learnings
<what cost time; what the defaults should do instead. One line each.>
```
