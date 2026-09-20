# MeetStream workflow blueprints

Import any JSON into n8n, select the MeetStream credential, and replace the marked destination-node placeholders with the customer's preferred integration. These are intentionally small, reviewable blueprints; they do not contain credentials or customer data.

1. `01-calendar-auto-join.json` — calendar handoff → Create Bot
2. `02-transcript-to-crm.json` — meeting completion → resolve post-call transcript → CRM handoff
3. `03-live-transcript-llm.json` — resolve post-call transcript → LLM summarisation handoff (not a real-time trigger)
4. `04-post-meeting-recap.json` — meeting completion → Get Summary → email/chat handoff
5. `05-recording-to-storage.json` — meeting completion → Get Recording → storage handoff
