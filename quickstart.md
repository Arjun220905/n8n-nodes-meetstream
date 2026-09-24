# Local quickstart

This guide shows how to run and manually test the MeetStream n8n node from VS Code on macOS.

## 1. Install the prerequisites

Install these once:

- [VS Code](https://code.visualstudio.com/)
- Node.js 24 or newer
- A MeetStream API key

Check your Node version in Terminal:

```bash
node --version
```

The output must be `v24.x` or newer. If you use Homebrew, you can install Node 24 with:

```bash
brew install node@24
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
```

If you use `nvm` or `fnm`, select your Node 24 installation instead.

## 2. Open the repository in VS Code

In VS Code, choose **File → Open Folder…** and open:

```text
/Users/arjun/meetstream.ai/n8n-nodes-meetstream
```

Then open **Terminal → New Terminal**. Confirm that the terminal is in the repository:

```bash
pwd
```

It should end with `meetstream.ai/n8n-nodes-meetstream`.

## 3. Install dependencies and run the automated checks

Run these commands in the VS Code terminal:

```bash
npm ci
npm run lint
npm test
npm audit --omit=dev
```

What they do:

- `npm ci` installs the exact locked dependency versions.
- `npm run lint` checks the node against n8n’s community-node rules.
- `npm test` builds the TypeScript and runs the request-shape, validation, and template tests.
- `npm audit --omit=dev` checks production dependencies. This package intentionally has no runtime dependencies.

All commands should finish without errors before doing a live API test.

## 4. Start local n8n with the node loaded

In the same terminal, run:

```bash
npm run dev
```

Leave this terminal running. Open [http://localhost:5678](http://localhost:5678) in your browser. The n8n development server loads the TypeScript node from this repository.

To stop it later, focus the terminal and press `Ctrl+C`.

## 5. Create the n8n credential

In local n8n:

1. Create or sign in to the local owner account if prompted.
2. Create a workflow and add the **MeetStream** node.
3. In the node’s **Credential** field, choose **Create New Credential**.
4. Paste your MeetStream API key into the API key field.
5. Save the credential and use n8n’s **Test** button if shown.

Keep the key in n8n’s encrypted credential store. Do not paste it into workflow JSON, source files, screenshots, or Git.

## 6. Run a safe live test first

Use a completed MeetStream bot ID that already belongs to your account. Start with:

1. Resource: **Bot**
2. Operation: **Get Bot**
3. Bot ID: your existing bot ID
4. Click **Execute step**

A successful result confirms that VS Code, the local n8n server, the credential, and the MeetStream API are connected correctly.

Next, try **Bot → Get Transcriptions** with the same bot ID. This lists post-call transcription runs. If the provider is `meeting_captions`, `transcript_id` is normally `null`; use the caption artifact URL returned by **Get Bot** instead. For a post-call provider that returns a transcript ID, pass that ID to **Transcript → Get Transcript**.

Other read-only operations are:

- **Bot → Get Recording**: retrieves the processed recording when available.
- **Bot → Get Summary**: retrieves a generated AI summary. A 404 means MeetStream has not generated one for that bot.

## 7. Test bot creation only with your own meeting

**Create Bot** causes a bot to join a real meeting. Use a meeting that you own and can admit, and confirm the meeting link is HTTPS. After testing, use **Bot → Leave Meeting** so the test bot does not remain in the meeting.

Do not commit real meeting links, bot IDs, signed recording URLs, transcripts, or API keys.

## 8. Import a workflow template

The five starter templates are in `templates/`. In n8n, use **Import from File** and select one JSON file. Then select your MeetStream credential and replace the placeholder Set node values.

The transcript-to-CRM and transcript-to-LLM templates expect a post-call bot ID, list transcription runs, and then resolve the first transcript ID. They are post-call starters; this node does not provide a real-time trigger.

## 9. Useful manual checks

Test these cases before publishing changes:

- A valid HTTPS meeting link is accepted by **Create Bot**.
- An HTTP link is rejected before any API request.
- Blank bot and transcript IDs are rejected before any API request.
- IDs containing spaces or slashes are encoded safely.
- **Raw Response** adds `raw=true` to transcript requests.
- n8n’s **Continue On Fail** option returns an error item instead of stopping the entire workflow.

After changing source code, stop and restart `npm run dev`, then rerun `npm run lint` and `npm test`.

## 10. Before opening a pull request

Run the complete local gate:

```bash
npm run lint
npm test
npm pack --dry-run
npm audit --omit=dev
git diff --check
git status
```

The working tree should contain only the changes you intended to commit.
