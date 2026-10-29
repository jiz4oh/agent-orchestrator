# ADR-0003: Verified V2 plugin and session lifecycle

- Status: Accepted
- Date: 2026-10-29
- Refines ADR-0001 and ADR-0002; supersedes their initial tool-loading and unverified runtime assumptions. Their dedicated-session and non-interrupting Steering decisions remain in force.

## Decision

Use a dependency-free native V2 project plugin under `.opencode/plugins/orchestrator/`, registering tools with `ctx.tool.transform`. Replace the undeclared V1 `@opencode-ai/plugin` tool imports. Keep HTTP requests in the existing core module. No OpenCode or OpenChamber core changes are required.

Bind every worker with `location.directory` at session creation. Inherit `OPENCODE_HOST` when no explicit URL is supplied. Cancel with `interrupt?resume=false`. Refresh reports active execution, persisted session outcome and pending inputs separately from dispatch history; it never restarts work. Preserve the existing locked, atomic JSON registry.

Serialize sending and cancellation with a per-task file lock around the state check, HTTP operation and registry update. A controlled regression reproduced cancellation acknowledgment followed by a late `resume:true` admission in the original implementation; a barrier test now rejects that interleaving while separate tasks remain independent.

## Observed evidence

The installed OpenCode 2.1.4 `/openapi.json`, authenticated API responses and OpenChamber 2.5.2 packaged session-service source established the contract. OpenChamber desktop on port 57123 reported an existing authenticated OpenCode service on port 4096. The managed agent-tool callback was unavailable because the shared server lacked callback environment variables; the existing desktop client token allowed the authorized HTTP fallback without changing global configuration.

- OpenChamber-created coordinator: `ses_e795e94a6ffevhmx1dlE18zZKJ` (`Orchestrator`).
- Task A: `TASK-0cd0d09f`, worker `ses_e795e74edffeqcSKbCFGjLrg41`. Native `task_create` completed in approximately 2.7 seconds while its worker continued.
- Task B: `TASK-8adf09a2`, worker `ses_e795e18acffeaSI5XQxn4mmut8`. Both appeared together in `/api/session/active` with separate directories and prompts.
- Steering update `99f9996b-c7fb-4bd9-b5ad-87214940c3b4` admitted message `msg_186a203be001eW1sr7e1BNa4hN` during A's first shell wait. It was projected after that tool finished and before the next model step. Assistant `msg_186a258b0001PU0CFHWxGj1jvo` acknowledged the new requirement and continued the original execution. Final assistant `msg_186a34779001MBdLjGVuFPBxE3` and `result-a.txt` both contained `STEER_7F29` and explained the change. A's timeline contained no intermediate idle or interruption; only the final successful idle.
- B cancellation returned `interrupted: true`, aborted its shell and produced `idle: interrupted`. A remained active in the coordinator's subsequent `task_list` response.
- Queue probe `ses_e795aee15ffeU66cHcSHAby9yB` admitted a follow-up while a shell ran, completed the original `BASE_DONE` answer, then projected the queued user message and returned `QUEUE_DONE`. Both turns shared a single final idle. Requiring an idle between queued turns was an incorrect test assumption, corrected against the actual message timeline.
- OpenChamber's authenticated `/api/session/{id}` and message proxy returned both workers and exactly the same message records as OpenCode. Visual sidebar rendering has not been inspected.
- A private server on port 4197 used separate `XDG_DATA_HOME` and `XDG_STATE_HOME`. After termination and restart, completed worker `ses_e795bb351ffenyb4eMSJsewe7M` retained identical messages. A parked queue in `ses_e795b9f8fffepS5EMAO7lvU2eY` persisted and was reported as `pending_recovery`; neither was automatically dispatched by registry refresh. Both private processes were stopped. The shared service was not restarted.

## Limits and alternatives

HTTP admission alone is insufficient proof of Steering; inspect the projected user message, subsequent model behavior, final artifact and absence of an intermediate idle. Tool-boundary ingestion has been verified; token-level interruption is not promised.

Restart inspection does not provide automatic run recovery or acceptance checking. The private restart check covered completed and parked work, not a crash in the middle of a provider/tool operation. Cancellation interrupts execution but does not delete pending inbox entries or undo external side effects. A stopped task can therefore still show pending work that requires inspection.

Do not install the plugin globally, patch core, introduce an SDK dependency solely for these requests, or emulate Steering with abort/restart. Keep automated API/registry regression tests and repeat live checks when upgrading OpenCode.
