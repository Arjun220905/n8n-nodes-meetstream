# n8n-nodes-meetstream

n8n community node for the [MeetStream](https://meetstream.ai) meeting-bot API.

## Install after publishing

After `n8n-nodes-meetstream` is public on npm, self-hosted n8n users can open **Settings → Community nodes**, enter the package name, and install it. Verified community nodes can also be installed from the n8n node panel.

Create a MeetStream credential with an API key from [app.meetstream.ai/api-key](https://app.meetstream.ai/api-key). Keep API keys in n8n credentials; do not add them to workflow JSON, source control, or environment files.

## Included operations

- **Bot → Create Bot**: send a bot to an HTTPS meeting link.
- **Bot → Get Bot**: retrieve bot details, including `transcript_id` when available.
- **Bot → Get Transcriptions**: list post-call transcription runs and their `transcript_id` values.
- **Bot → Get Recording**: retrieve processed video.
- **Bot → Get Summary**: retrieve the AI meeting summary.
- **Bot → Leave Meeting**: make the bot leave while retaining data.
- **Transcript → Get Transcript**: retrieve a formatted transcript by `transcript_id`, or select **Raw Response** for the provider payload.

For post-call providers, first use **Get Transcriptions**, then map its `transcript_id` into **Get Transcript**. Bots configured with MeetStream's `meeting_captions` provider deliberately return no `transcript_id`; use the caption artifact exposed by **Get Bot** instead. Similarly, **Get Summary** returns a 404 until MeetStream has generated a summary for that bot.

Requests are restricted to `https://api.meetstream.ai`, use a 60-second timeout, and rely on n8n's retry-on-fail controls for rate-limit backoff. The node never logs API keys.

## Development and local runtime test

For a beginner-friendly VS Code walkthrough, see [quickstart.md](quickstart.md).

Use Node.js 24 or newer. The current n8n runtime requires Node.js 24+.

```bash
npm ci
npm run lint
npm run build
npm test
npm run dev
```

`npm run dev` starts a local n8n instance with this node loaded. Open `http://localhost:5678`, create a MeetStream credential, then first run **Bot → Get Bot** against an existing bot ID. Use a meeting you own for any **Create Bot** test and call **Leave Meeting** afterwards.

## Release and verification

The package has no runtime dependencies and is released only through GitHub Actions with npm provenance. Before the first release:

1. Configure npm trusted publishing for this repository and `publish.yml`, allowing direct `npm publish` (or add a narrowly scoped `NPM_TOKEN` as the fallback).
2. Run `npm run release` from a clean `main` branch. It creates the version commit and matching tag, then pushes both.
3. Confirm the GitHub Action published the package with provenance.
4. Run `npx @n8n/scan-community-package n8n-nodes-meetstream` after publication.
5. Submit the public npm package through the n8n Creator Portal for verification.

If this repository is transferred to `meetstream-ai`, update the `repository.url` metadata and npm trusted-publisher configuration before the next release.

## Workflow blueprints

The `templates/` directory contains five importable starting points covering calendar auto-join, CRM transcript capture, transcript-to-LLM summarisation, post-meeting recap, and customer storage delivery. Each blueprint begins with an editable **Set** node so it can be tested safely, then should be replaced with a customer-specific trigger or input item that supplies its meeting link, bot ID, or transcript ID. For post-call transcription templates, insert **Get Transcriptions** before **Get Transcript** to resolve the ID; `meeting_captions` bots use their caption artifact instead. This node has no trigger/webhook listener, so the LLM blueprint is intentionally post-call rather than a real-time transcript integration.

## Support

MeetStream API documentation: [docs.meetstream.ai](https://docs.meetstream.ai)
