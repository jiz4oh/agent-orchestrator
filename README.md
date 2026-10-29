# Agent Orchestrator

OpenChamber dedicated coordinator session using OpenCode **V2 Server API**. Creates background worker sessions, provides **live steering** to busy sessions, status and cancellation. No OpenChamber fork, Koishi or OpenClaw required.

## Requirements

- Node.js >= 20
- OpenCode V2 with `/api/session` and `/api/session/{sessionID}/prompt` endpoints
- OpenChamber opening this repository as a project
- OpenCode custom tools with `@opencode-ai/plugin`

Run OpenCode V2 server and set `OPENCODE_URL` to the same server OpenChamber uses (default `http://127.0.0.1:4096`). Optional: `OPENCODE_SERVER_PASSWORD`, `ORCHESTRATOR_WORKER_DIR`, `ORCHESTRATOR_STORE`, `OPENCODE_TIMEOUT_MS`.

Open this project in OpenChamber, create a session titled **Orchestrator**. The instructions in `AGENTS.md` guide it.

Example:
- `创建任务：在 /absolute/path/to/project 实现 API 测试`
- `给 TASK-xxxx 追加要求：测试需要覆盖失败重试` (sent with `delivery: "steer"` immediately even when busy)
- `列出任务`
- `取消 TASK-xxxx`

## Tools

- `task_create(title,prompt,directory?,agent?)`: create an independent V2 session and immediately admit its first prompt.
- `task_send(id,instruction,delivery?)`: submit to the **same running V2 session** with explicit `delivery:"steer"` (or `"queue"` if requested). This is real server-side prompt admission, not a local pending-message queue.
- `task_list(refresh?)`: tasks and optional V2 active-session snapshot.
- `task_cancel(id)`: V2 session interrupt with `resume=false`.

## Steering semantics

V2 `POST /api/session/{sessionID}/prompt` supports `delivery: "steer" | "queue"`. A successful response means the prompt was **admitted** to the inbox, not that the worker immediately incorporated it in the current model token stream. The worker applies steering at its next safe processing boundary. Do not use legacy `prompt_async` for busy-session steering: affected older versions can persist a message without scheduling its turn.

This version intentionally **requires V2**. It fails loudly on incompatible servers; no silent legacy fallback.

## Reliability and security

- JSON store at `.state/tasks.json` guarded by an atomic lock and rename. Single-machine MVP, not multi-host durable queue.
- A create is recorded before dispatch. Ambiguous submission failures are marked `dispatch_uncertain`; inspect session rather than blindly retrying.
- No automatic task completion inference, event replay, worktree isolation, push notifications, or multi-machine scheduling yet.
- Protect OpenCode server with loopback/Tailscale and credentials. Workers have the filesystem access of their OpenCode process.
- The project-local tools are only registered in this project; avoid installing as a global plugin.
- Verify OpenChamber shares the same OpenCode instance and worker project visibility.
- `npm test` runs mock V2 API tests only; live OpenCode/OpenChamber integration must be tested on your host.

See [ADR index](docs/adr/README.md).
