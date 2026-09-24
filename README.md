# n8n-nodes-meetstream

n8n community node for the [MeetStream](https://meetstream.ai) meeting-bot API.

## Install after publishing

After `n8n-nodes-meetstream` is public on npm, self-hosted n8n users can open **Settings → Community nodes**, enter the package name, and install it. Verified community nodes can also be installed from the n8n node panel.

Create a MeetStream credential with an API key from [app.meetstream.ai/api-key](https://app.meetstream.ai/api-key). Keep API keys in n8n credentials; do not add them to workflow JSON, source control, or environment files.

## Included operations

- **Bot → Create Bot**: send or schedule a bot, choose video and post-call/live transcription, attach callback URLs and metadata, and prevent duplicates with MeetStream idempotency keys.
- **Bot → Get Bot**: retrieve bot details, including `transcript_id` when available.
- **Bot → Get Transcriptions**: list post-call transcription runs and their `transcript_id` values.
- **Bot → Get Recording**: retrieve processed video.
- **Bot → Get Summary**: retrieve the AI meeting summary.
- **Bot → Leave Meeting**: make the bot leave while retaining data.
- **Transcript → Get Transcript**: retrieve a formatted transcript by `transcript_id`, or select **Raw Response** for the provider payload.

For post-call providers, first use **Get Transcriptions**, then map its `transcript_id` into **Get Transcript**. Formatted transcript arrays are returned in the node's `data` property so each input item remains one n8n item. Bots configured with MeetStream's `meeting_captions` provider deliberately return no `transcript_id`; use the caption artifact exposed by **Get Bot** instead. Similarly, **Get Summary** returns a 404 until MeetStream has generated a summary for that bot.

Lifecycle callbacks and live transcripts are different MeetStream channels: **Lifecycle Callback URL** receives status/post-call events, while **Live Transcript Webhook URL** receives streaming transcript chunks. Live providers do not emit the normal post-call transcript events. Requests are restricted to `https://api.meetstream.ai`, use a 60-second timeout, and rely on n8n's retry-on-fail controls for rate-limit backoff. The node never logs API keys.

## Development and local runtime test

For a beginner-friendly VS Code walkthrough, see [quickstart.md](quickstart.md).

Use Node.js 24 or newer. The current n8n 2.40 runtime and its native expression sandbox require Node 24+.

```bash
npm ci
npm run lint
npm run build
npm test
npm run dev
```

`npm run dev` starts a local n8n instance with this node loaded and prepares development-compatible workflow files in `.local/templates/`. Open `http://localhost:5678`, create a MeetStream credential, then first run **Bot → Get Bot** against an existing bot ID. Use a meeting you own for any **Create Bot** test and call **Leave Meeting** afterwards.

The development CLI registers the node as `CUSTOM.meetStream`; published packages use `n8n-nodes-meetstream.meetStream`. For local testing, import `.local/templates/*.json`. The five files in `templates/` retain the published type required by the n8n template library.

## Release and n8n verification

The package has no runtime dependencies and is released only through GitHub Actions with npm provenance. Before the first release:

1. Configure npm trusted publishing for this repository and `publish.yml`, allowing direct `npm publish` (or add a narrowly scoped `NPM_TOKEN` as the fallback).
2. Run `npm run release` from a clean `main` branch. It creates the version commit and matching tag, then pushes both.
3. Confirm the GitHub Action published the package with provenance.
4. Run `npx @n8n/scan-community-package n8n-nodes-meetstream` after publication.
5. Submit the public npm package through the n8n Creator Portal for verification.

If this repository is transferred to `meetstream-ai`, update the `repository.url` metadata and npm trusted-publisher configuration before the next release.

See [docs/release-and-verification.md](docs/release-and-verification.md) for the exact release gate, evidence to keep, template-publication steps, and ownership handoff.

## Workflow blueprints

The `templates/` directory contains five complete, importable workflows:

1. Google Calendar event start → extract the meeting URL → create one deduplicated MeetStream bot.
2. `transcription.processed` webhook → resolve and format the transcript → create a HubSpot meeting engagement.
3. Create a streaming bot and receive finalized live turns → OpenAI summarisation.
4. `transcription.processed` webhook → fetch the transcript → summarize it with OpenAI → post it to Slack.
5. `video.processed` webhook → fetch a fresh presigned URL → download the file → upload it to Amazon S3.

They intentionally contain no credentials or customer data. After import, connect the credentials and destination named in [templates/README.md](templates/README.md). Webhook workflows use n8n's immediate response mode so MeetStream gets a fast 2xx acknowledgement.

## Webhook security and rate limiting

n8n owns the HTTP listener; this package does not open a server or bypass n8n's authentication controls. MeetStream per-bot `callback_url` deliveries are not signed. For production, prefer a signed MeetStream workspace webhook and verify it at an API gateway/reverse proxy before forwarding to n8n. Apply request-size limits and per-IP/per-path rate limits there, keep n8n patched, and never make the n8n editor publicly reachable. See [docs/webhook-security.md](docs/webhook-security.md).

## Support

MeetStream API documentation: [docs.meetstream.ai](https://docs.meetstream.ai)
