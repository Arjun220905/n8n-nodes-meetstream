# MeetStream workflow templates

The five JSON files in this directory are the publishable n8n-library versions. Import one with **Workflows → Import from File** after installing the published `n8n-nodes-meetstream` package.

Credentials are deliberately omitted because template files are public. After import, read the large **START HERE** note. When a MeetStream node asks for a credential, select the **MeetStream account** you already saved. Never paste the API key into a Code/Edit Fields node or workflow JSON.

## Which template should I use?

| I want to… | Start with | Other account needed |
| --- | --- | --- |
| Automatically send a bot to calendar meetings | `01-calendar-auto-join.json` | Google Calendar |
| Save completed transcripts in a CRM | `02-transcript-to-crm.json` | HubSpot |
| Summarize live speaker turns | `03-live-transcript-llm.json` | OpenAI |
| Email a recap after each meeting | `04-post-meeting-recap.json` | OpenAI and an email/SMTP account |
| Copy recordings to my storage | `05-recording-to-storage.json` | Amazon S3 |

Start with template 1 if you only want to confirm that the saved MeetStream credential works.

### Local development exception

`npm run dev` loads the node as `CUSTOM.meetStream`, while a published package uses `n8n-nodes-meetstream.meetStream`. Importing these publishable files into the development server therefore shows **Unrecognized node type**. Run `npm run templates:local` (also run automatically before `npm run dev`) and import the matching file from `../.local/templates/` instead. Generated local files are ignored by Git and must not be submitted to the n8n template library.

## 1. Google Calendar auto-join

File: `01-calendar-auto-join.json`

Select your saved MeetStream credential, connect Google Calendar, choose a calendar, and publish the workflow. It accepts Google Meet, Zoom, or Microsoft Teams links and avoids creating duplicate bots when n8n retries.

The template enables MeetStream post-call transcription. Add a **Lifecycle Callback URL** if this same bot should feed templates 2, 4, or 5, or register those URLs as MeetStream workspace webhooks.

## 2. Transcript to HubSpot

File: `02-transcript-to-crm.json`

Select your saved MeetStream credential and connect HubSpot. Publish the workflow and register its production webhook URL in MeetStream for `transcription.processed`. When creating the bot, include the target contact in its custom attributes:

```json
{
  "hubspot_contact_id": "12345"
}
```

The workflow ignores unrelated/failed events, selects the newest successful transcription run, formats all speaker segments, and creates a HubSpot meeting engagement associated with that contact. It is for post-call providers, not `meeting_captions` or streaming-only providers.

## 3. Live transcript to OpenAI

File: `03-live-transcript-llm.json`

Select your saved MeetStream credential and connect OpenAI. Publish the workflow, copy the live webhook's production URL into **Configure meeting and production webhook**, add a meeting link you own, and run the manual branch once.

The webhook acknowledges immediately. Only finalized `end_of_turn` payloads reach OpenAI, avoiding repeated summaries of interim words. This produces a concise summary per finalized speaker turn; connect the OpenAI output to your UI, chat, or datastore if you want to publish or accumulate the summaries.

## 4. Post-meeting recap by email

File: `04-post-meeting-recap.json`

Select your saved MeetStream credential, connect OpenAI, and connect an email account in **Email meeting recap**. Replace both `you@example.com` addresses, publish the workflow, and register its production webhook URL in MeetStream for `transcription.processed`. The workflow fetches the completed transcript, asks OpenAI for a structured recap, and emails it. It does not require a separate MeetStream summary workflow.

## 5. Recording to Amazon S3

File: `05-recording-to-storage.json`

Select your saved MeetStream credential, connect AWS, replace `replace-with-your-private-bucket`, publish the workflow, and register its production webhook URL in MeetStream for `video.processed`. It downloads each completed recording and uploads it to `meetstream/<bot_id>.mp4` in S3.

Use a private bucket, least-privilege AWS credentials restricted to the target prefix, server-side encryption, retention/lifecycle rules, and access logging.

## Webhook safety

The Webhook nodes return 2xx immediately so MeetStream is not held open while downstream APIs run. Per-bot callback deliveries are not signed. Before production, follow [the webhook security guide](../docs/webhook-security.md), configure n8n execution pruning, and test duplicate and malformed deliveries. The Code nodes discard unrelated events; destination writes still need the provider's normal least-privilege credentials.
