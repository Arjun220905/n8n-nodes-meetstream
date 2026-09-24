# MeetStream workflow templates

Import each JSON file with **Workflows → Import from File**. Credentials are deliberately omitted. Select your own credentials after import, review every expression, run with test data, and only then activate the workflow.

## 1. Google Calendar auto-join

File: `01-calendar-auto-join.json`

Connect Google Calendar and MeetStream credentials, select a calendar, and activate the workflow. It runs when an event starts, accepts Google Meet, Zoom, or Microsoft Teams links from the event, and uses the calendar event ID plus occurrence time as both MeetStream deduplication and retry keys. Events without a supported HTTPS meeting URL stop before an API request.

The template enables MeetStream post-call transcription. Add a **Lifecycle Callback URL** if this same bot should feed templates 2, 4, or 5, or register those URLs as MeetStream workspace webhooks.

## 2. Transcript to HubSpot

File: `02-transcript-to-crm.json`

Connect MeetStream and HubSpot OAuth credentials. Activate the workflow and register its production webhook URL for `transcription.processed`. When creating the bot, include the target contact in its custom attributes:

```json
{
  "hubspot_contact_id": "12345"
}
```

The workflow ignores unrelated/failed events, selects the newest successful transcription run, formats all speaker segments, and creates a HubSpot meeting engagement associated with that contact. It is for post-call providers, not `meeting_captions` or streaming-only providers.

## 3. Live transcript to OpenAI

File: `03-live-transcript-llm.json`

Connect MeetStream and OpenAI credentials, activate the workflow, and copy the live webhook node's production URL into **Configure meeting and production webhook**. Replace the test meeting link, then execute the manual branch once. The MeetStream node creates a Deepgram Streaming bot and points live chunks at the webhook branch. A per-execution idempotency key makes the configured retries safe without preventing a later manual run.

The webhook acknowledges immediately. Only finalized `end_of_turn` payloads reach OpenAI, avoiding repeated summaries of interim words. This produces a concise summary per finalized speaker turn; connect the OpenAI output to your UI, chat, or datastore if you want to publish or accumulate the summaries.

## 4. Post-meeting recap to Slack

File: `04-post-meeting-recap.json`

Connect MeetStream and Slack credentials, select a Slack channel, activate the workflow, and register its production webhook URL for `bot.done`. The workflow ignores other lifecycle events, fetches the completed MeetStream summary, and posts it to Slack. It retries the summary read because artifact availability and rate limits can be transient.

## 5. Recording to Amazon S3

File: `05-recording-to-storage.json`

Connect MeetStream and AWS credentials, replace `replace-with-your-private-bucket`, activate the workflow, and register its production webhook URL for `video.processed`. The workflow fetches a fresh short-lived MeetStream video URL, downloads the binary immediately, and uploads it to `meetstream/<bot_id>.mp4` in S3.

Use a private bucket, least-privilege AWS credentials restricted to the target prefix, server-side encryption, retention/lifecycle rules, and access logging.

## Webhook safety

The Webhook nodes return 2xx immediately so MeetStream is not held open while downstream APIs run. Per-bot callback deliveries are not signed. Before production, follow [the webhook security guide](../docs/webhook-security.md), configure n8n execution pruning, and test duplicate and malformed deliveries. The Code nodes discard unrelated events; destination writes still need the provider's normal least-privilege credentials.
