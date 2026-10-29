# ADR-0002: Use OpenCode V2 prompt admission for live steering

- Status: Accepted
- Date: 2026-10-29

## Context

The old MVP stored follow-up instructions locally and required manual delivery. We need instructions to reach **busy** worker sessions immediately. Legacy `/session/:id/prompt_async` is not a reliable substitute on busy sessions; a known issue reported that the message could persist without running its turn.

## Decision

Require V2 endpoints. Submit both initial prompts and follow-ups using `POST /api/session/{sessionID}/prompt` with an explicit `delivery:"steer"`. Offer `queue` as an opt-in alternative. Track server admission status and avoid retrying ambiguous failures. Do not abort/restart a session to emulate steering.

## Semantics and risks

Live steering is inbox admission while the run is active, not token-level interruption. It is applied at the next processing boundary. Success means admitted, not incorporated or completed. If the installed OpenCode version does not support V2, return a compatibility error rather than pretending steering worked.

## Alternatives rejected

- Local pending queue: not real-time.
- Legacy prompt_async: busy-session lost-turn risk.
- Abort + prompt: discards ongoing work and violates non-interruption goal.

## References

- https://dev.opencode.ai/v2/docs/api
- https://opencode.ai/v2/docs/build/plugins/server/
- https://github.com/anomalyco/opencode/issues/46842
