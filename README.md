# factory-mcp

An MCP server that lets any MCP client list and watch KaaS Factory runs.

**Status: in development.** Seven read tools work today: `list_repos`, `list_runs`, `get_run`, `list_events`, `spend`, `get_metrics` and `watch_events`. Nothing is published to npm yet.

## What it is

A thin server over the factory's HTTP API, over stdio or streamable HTTP. It only calls routes the factory serves. `approve_plan`, `steer` and `retry` follow once the factory has write routes for them.

## Part of KaaS

This repo belongs to [KaaS Factory](https://github.com/KaaS-team/KaaS-factory), the open-source software factory that turns tracker issues into reviewed, gated pull requests. More at [kaas.team](https://kaas.team).

Licensed Apache-2.0. Contributions are signed off under the DCO.
