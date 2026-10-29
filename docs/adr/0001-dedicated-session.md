# ADR-0001: Dedicated OpenChamber Orchestrator Session

- Status: Accepted
- Date: 2026-10-29

## Context

We need Grok Bot-like concurrent tasks without replacing the existing OpenChamber UI. The coordinator should remain responsive while multiple OpenCode worker sessions execute independently.

## Decision

Use a single dedicated coordinator project/session in OpenChamber. Project-local OpenCode tools create and manage independent worker sessions via a V2 server API. Maintain Task-to-Session mappings in an external JSON store. Do not patch OpenChamber, OpenCode core, or introduce Koishi/OpenClaw at MVP stage.

## Consequences

Minimal UI work, explicit task identifiers, isolated execution contexts. All coordinator messages still pass through one short-lived agent turn; cross-task automatic routing and durable orchestration remain incremental work. JSON storage does not support distributed scheduling.
