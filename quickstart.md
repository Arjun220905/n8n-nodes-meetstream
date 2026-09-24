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

The output must be `v24.x` or newer. n8n 2.40.6 requires Node 24; Node `v22.23.2` can build this node but cannot reliably start the current n8n runtime. Node 24 is already installed on this Mac at `/opt/homebrew/opt/node@24`.

```bash
brew install node@24
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
```

If you use `nvm` or `fnm`, select Node 24 instead. Verify the same VS Code terminal prints `v24.x` before running `npm ci` or `npm run dev`.

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

Leave this terminal running. Open [http://localhost:5678](http://localhost:5678) in your browser. The n8n development server loads the TypeScript node from this repository. The `predev` step also creates five development-compatible workflows in `.local/templates/`.

If the terminal says port 5678 is already in use, an n8n server is already running. Use that server if it came from this repository, or stop it with `Ctrl+C` in the terminal where it was started before running `npm run dev` again.

To stop it later, focus the terminal and press `Ctrl+C`.

## 5. Create the n8n credential

In local n8n:

1. Create or sign in to the local owner account if prompted.
2. Create a workflow and add the **MeetStream** node.
3. In the node’s **Credential to connect with** field, choose **Create New Credential**.
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

**Get Transcript** returns formatted transcript segments inside `data`, for example `{{$json.data[0].transcript}}`.

Other read-only operations are:

- **Bot → Get Recording**: retrieves the processed recording when available.
- **Bot → Get Summary**: retrieves a generated AI summary. A 404 means MeetStream has not generated one for that bot.

## 7. Test bot creation only with your own meeting

**Create Bot** causes a bot to join a real meeting. Use a meeting that you own and can admit, and confirm the meeting link is HTTPS. Choose **Post-Call** transcription for templates that wait for `transcription.processed`, or **Live Webhook** for streaming chunks. Live transcription requires a public HTTPS webhook URL; `localhost` is not reachable from MeetStream. After testing, use **Bot → Leave Meeting** so the test bot does not remain in the meeting.

Do not commit real meeting links, bot IDs, signed recording URLs, transcripts, or API keys.

## 8. Import a workflow template

For the local development server, import from `.local/templates/`, not `templates/`. The development CLI registers the node as `CUSTOM.meetStream`; the generated files account for that automatically. Start with the large **START HERE** note, connect the requested credentials, and replace the clearly marked calendar, channel, bucket, webhook, or meeting values.

The five files in `templates/` deliberately use the published node type and are the versions submitted to the n8n template library. Import those only after the npm package is installed. If you import one into `npm run dev`, n8n will show `Unrecognized node type: n8n-nodes-meetstream.meetStream` even though the development node itself is loaded.

For webhook templates, activate the workflow and use its **Production URL**, not its temporary test URL. A local n8n server needs a public HTTPS tunnel for MeetStream to reach it. The live-transcript template contains two branches: run the manual branch once to create the bot, while the active webhook branch receives final speaker turns and sends them to OpenAI.

## 9. Useful manual checks

Test these cases before publishing changes:

- A valid HTTPS meeting link is accepted by **Create Bot**.
- An HTTP link is rejected before any API request.
- Blank bot and transcript IDs are rejected before any API request.
- IDs containing spaces or slashes are encoded safely.
- **Raw Response** adds `raw=true` to transcript requests.
- Invalid callback URLs, dates, JSON settings, and deduplication keys fail before an API request.
- A top-level transcript array is wrapped as `{ "data": [...] }`.
- n8n’s **Continue On Fail** option returns an error item instead of stopping the entire workflow.

Node source changes hot-rebuild while `npm run dev` is running. After changing templates, rerun `npm run templates:local` and re-import the generated workflow. Before finishing any change, rerun `npm run lint` and `npm test`.

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
