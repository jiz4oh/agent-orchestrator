# Agent Orchestrator

OpenChamber dedicated coordinator session using OpenCode **V2 Server API**. Creates background worker sessions, provides **live steering** to busy sessions, status and cancellation. No OpenChamber fork, Koishi or OpenClaw required.

## Requirements

- Node.js >= 20
- OpenCode V2 with `/api/session` and `/api/session/{sessionID}/prompt` endpoints
- OpenChamber opening this repository as a project
- OpenCode 2.1.4 (verified) with native project plugin loading

Run `npm install` and `npm test`. No runtime dependencies are required: `.opencode/plugins/orchestrator/index.js` registers four native V2 tools through `ctx.tool.transform`. The plugin loads only for this project; existing locations may need `POST /api/location/reload` with `x-opencode-directory` set to the repository path.

Set `OPENCODE_URL` to the same server OpenChamber uses (falls back to inherited `OPENCODE_HOST`, then `http://127.0.0.1:4096`). Optional: `OPENCODE_SERVER_PASSWORD` (HTTP Basic, username `opencode`), `ORCHESTRATOR_WORKER_DIR`, `ORCHESTRATOR_STORE`, `OPENCODE_TIMEOUT_MS`. These variables belong to the OpenCode **server process**, not a shell opened after it started. Do not restart a shared server to configure an experiment; use a private instance.

Open this project in OpenChamber, create a session titled **Orchestrator**. The instructions in `AGENTS.md` guide it.

Example:
- `创建任务：在 /absolute/path/to/project 实现 API 测试`
- `给 TASK-xxxx 追加要求：测试需要覆盖失败重试` (sent with `delivery: "steer"` immediately even when busy)
- `列出任务`
- `取消 TASK-xxxx`

## Tools

- `task_create(title,prompt,directory?,agent?)`: create an independent V2 session and immediately admit its first prompt.
- `task_send(id,instruction,delivery?)`: submit to the **same running V2 session** with explicit `delivery:"steer"` (or `"queue"` if requested). This is real server-side prompt admission, not a local pending-message queue.
- `task_list(refresh?)`: tasks and optional live activity, persisted session outcome and pending inbox count. `status` records dispatch/cancellation history; `executionStatus` reports `running`, `succeeded`, `failed`, `interrupted`, `pending_recovery`, `inactive_unresolved` or `unavailable`. Server success still requires checking the worker's actual deliverables.
- `task_cancel(id)`: V2 session interrupt with `resume=false`.

## Steering semantics

V2 `POST /api/session/{sessionID}/prompt` accepts `{ "text": "...", "delivery": "steer", "resume": true }`. A successful response means the prompt was **admitted** to the inbox, not that the worker immediately incorporated it in the current model token stream. The worker applies steering at its next safe processing boundary. `queue` waits for the current prompt's final response before its own turn; both turns may share one execution drain and final idle. `resume: false` parks input without scheduling execution. Do not use legacy `prompt_async` for busy-session steering.

Create workers using `POST /api/session` with `location: { directory: "/absolute/path" }`, optionally `agent`. A top-level `directory` was silently ignored on the tested server. Responses normally wrap results in `data`; interruption returns `{ interrupted: boolean }` directly. Cancellation explicitly uses `POST /api/session/{id}/interrupt?resume=false`.

This version intentionally **requires V2**. It fails loudly on incompatible servers; no silent legacy fallback.

## Reliability and security

- JSON store at `.state/tasks.json` guarded by an atomic lock and rename. Single-machine MVP, not multi-host durable queue.
- Per-task locks serialize sending and cancellation, including HTTP admission and status updates, so a send waiting behind cancellation cannot resume the worker. Different tasks remain independent.
- A create is recorded before dispatch. Ambiguous submission failures are marked `dispatch_uncertain`; inspect session rather than blindly retrying.
- No automatic task completion inference, event replay, worktree isolation, push notifications, or multi-machine scheduling yet.
- Restart recovery is inspection only: mappings and OpenCode sessions persist, and refresh reports pending or unresolved work without resubmitting it. An interrupted run is not automatically continued. Inspect the session and inbox before deciding to resume. A stale registry `.lock` after an unclean process exit requires manual inspection.
- Protect OpenCode server with loopback/Tailscale and credentials. Workers have the filesystem access of their OpenCode process.
- The project-local tools are only registered in this project; avoid installing as a global plugin.
- Verify OpenChamber shares the same OpenCode instance and worker project visibility.
- `npm test` runs API regression and concurrent registry tests. Live checks on 2026-10-29 used OpenCode 2.1.4, OpenChamber 2.5.2 and real model executions: native tool loading, two simultaneous workers, Steering ingestion during the same execution and final file/reply changes, isolated cancellation, and private-server restart persistence. OpenChamber's authenticated session/message proxy returned the workers' full records; visual sidebar rendering was not inspected. See [ADR-0003](docs/adr/0003-verified-v2-runtime.md) for evidence IDs and limitations.

See [ADR index](docs/adr/README.md).
