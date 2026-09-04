# n8n-nodes-meetstream

n8n community node for the [MeetStream](https://meetstream.ai) meeting-bot API.

## Install

In n8n, open **Settings → Community nodes**, enter `n8n-nodes-meetstream`, and install it. Create a MeetStream credential with an API key from [app.meetstream.ai/api-key](https://app.meetstream.ai/api-key).

## Included operations

- **Bot → Create Bot**: send a bot to an HTTPS meeting link.
- **Bot → Get Bot**: retrieve bot details, including `transcript_id` when available.
- **Bot → Get Recording**: retrieve processed video.
- **Bot → Get Summary**: retrieve the AI meeting summary.
- **Bot → Leave Meeting**: make the bot leave while retaining data.
- **Transcript → Get Transcript**: retrieve a transcript by `transcript_id`.

Requests are restricted to `https://api.meetstream.ai`, use a 60-second timeout, and rely on n8n's retry-on-fail controls for rate-limit backoff. The node never logs API keys.

## Development

```bash
npm ci
npm run lint
npm run build
npm test
```

The package is published through GitHub Actions with npm trusted publishing/provenance. Configure the repository owner, repository name, and `.github/workflows/publish.yml` in npm before creating a release tag.

## Workflow blueprints

The `templates/` directory contains five importable starting points covering calendar auto-join, CRM transcript capture, live LLM summarisation, post-meeting recap, and customer storage delivery. Each blueprint includes setup notes and must be connected to the customer's credentials after import.

## Support

MeetStream API documentation: [docs.meetstream.ai](https://docs.meetstream.ai)
