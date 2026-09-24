# Webhook security and abuse controls

MeetStream sends two kinds of webhook traffic:

- lifecycle and post-call events to `callback_url` or a workspace webhook;
- live transcript chunks to `live_transcription_required.webhook_url`.

The template Webhook nodes acknowledge requests immediately and filter on the documented event fields. MeetStream delivery is best-effort and does not retry non-2xx responses, so monitor failed n8n executions and retry them from n8n. n8n, not this community package, owns the public HTTP listener and its rate limits.

## Production baseline

1. Prefer a MeetStream workspace webhook. Workspace deliveries include `X-MeetStream-Signature` and `X-MeetStream-Timestamp`; per-bot `callback_url` deliveries are not signed.
2. Terminate HTTPS at a gateway or reverse proxy. Verify the workspace HMAC against the unmodified raw request body before forwarding it to n8n.
3. Reject stale timestamps to limit replay attacks. Keep a short-lived delivery-ID/hash cache if your gateway supports it.
4. Limit request bodies to a small JSON payload and allow only `POST` with `application/json`.
5. Apply a burst and sustained rate limit per webhook path. Choose limits from observed live-transcription volume; a fixed low limit can drop valid streaming chunks.
6. Keep the editor private. Expose only the `/webhook/...` routes required by the workflows.
7. Use separate, least-privilege credentials for MeetStream, HubSpot, Slack, OpenAI, and AWS. Rotate them without changing workflow JSON.
8. Prune n8n execution data and avoid saving successful payloads if transcripts contain sensitive information.
9. Keep destination operations idempotent where possible. MeetStream post-call events are sent at most once, but manual replay and operator retries can repeat downstream writes.

For local testing, a temporary HTTPS tunnel is acceptable. Do not treat the tunnel URL or a hard-to-guess webhook path as authentication.

## Rate-limit behavior

The MeetStream node uses a 60-second request timeout and supports n8n's **Retry On Fail**, **Max Tries**, and **Wait Between Tries** controls. The templates enable bounded retries only for read-only artifact fetches. Create Bot uses MeetStream deduplication/idempotency keys in the calendar template so a retry cannot normally create a second bot.

Do not add an unbounded retry loop around `429` or `5xx` responses. Honor server guidance, use exponential backoff at the workflow/gateway layer, and alert after the bounded retry budget is exhausted.
