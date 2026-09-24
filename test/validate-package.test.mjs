import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const source = await readFile(
	new URL('../nodes/MeetStream/MeetStream.node.ts', import.meta.url),
	'utf8',
);

test('package metadata exposes the MeetStream node and credential', () => {
	assert.equal(pkg.name, 'n8n-nodes-meetstream');
	assert.deepEqual(pkg.n8n.credentials, ['dist/credentials/MeetStreamApi.credentials.js']);
	assert.deepEqual(pkg.n8n.nodes, ['dist/nodes/MeetStream/MeetStream.node.js']);
	assert.equal(
		pkg.dependencies,
		undefined,
		'verified community packages must not ship runtime dependencies',
	);
	assert.equal(pkg.engines.node, '>=24');
});

test('local template generator adapts the package node type used by n8n-node dev', async () => {
	const script = await readFile(
		new URL('../scripts/prepare-local-templates.mjs', import.meta.url),
		'utf8',
	);
	assert.match(script, /n8n-nodes-meetstream\.meetStream/);
	assert.match(script, /CUSTOM\.meetStream/);
});

test('outbound API is pinned and meeting links require HTTPS', () => {
	assert.match(source, /https:\/\/api\.meetstream\.ai\/api\/v1/);
	assert.match(source, /allowedDomains: 'api\.meetstream\.ai'/);
	assert.match(source, /\.protocol === 'https:'/);
	assert.doesNotMatch(source, /process\.env|node:fs|node:child_process/);
});

test('workflow templates are complete, connected, and use concrete integrations', async () => {
	const names = (await readdir(new URL('../templates/', import.meta.url)))
		.filter((name) => name.endsWith('.json'))
		.sort();
	assert.equal(names.length, 5);
	const requiredTypes = {
		'01-calendar-auto-join.json': ['n8n-nodes-base.googleCalendarTrigger', 'n8n-nodes-base.code'],
		'02-transcript-to-crm.json': ['n8n-nodes-base.webhook', 'n8n-nodes-base.hubspot'],
		'03-live-transcript-llm.json': ['n8n-nodes-base.webhook', '@n8n/n8n-nodes-langchain.openAi'],
		'04-post-meeting-recap.json': [
			'n8n-nodes-base.webhook', '@n8n/n8n-nodes-langchain.openAi', 'n8n-nodes-base.slack',
		],
		'05-recording-to-storage.json': [
			'n8n-nodes-base.webhook', 'n8n-nodes-base.httpRequest', 'n8n-nodes-base.awsS3',
		],
	};
	const webhookPaths = new Set();

	for (const name of names) {
		const workflow = JSON.parse(await readFile(new URL(`../templates/${name}`, import.meta.url)));
		const nodeNames = new Set(workflow.nodes.map((node) => node.name));
		const nodeTypes = new Set(workflow.nodes.map((node) => node.type));
		assert.equal(workflow.settings?.executionOrder, 'v1');
			assert.ok(
				workflow.nodes.some((node) => node.type === 'n8n-nodes-meetstream.meetStream'),
				`${name} must demonstrate the MeetStream node`,
			);
			assert.ok(
				workflow.nodes.some((node) => node.type === 'n8n-nodes-base.stickyNote'),
				`${name} must explain setup inside the imported workflow`,
			);
		assert.ok(!nodeTypes.has('n8n-nodes-base.noOp'), `${name} must not contain placeholder No Operation nodes`);
		for (const type of requiredTypes[name]) assert.ok(nodeTypes.has(type), `${name} must contain ${type}`);
		for (const node of workflow.nodes) {
			assert.ok(node.id, `${name}: ${node.name} must have a stable ID`);
			if (node.type === 'n8n-nodes-base.webhook') {
				assert.equal(node.parameters.httpMethod, 'POST');
				assert.equal(node.parameters.responseMode, 'onReceived', `${name} must acknowledge webhooks immediately`);
				assert.ok(!webhookPaths.has(node.parameters.path), 'webhook paths must be unique');
				webhookPaths.add(node.parameters.path);
			}
			if (node.type === 'n8n-nodes-meetstream.meetStream' && node.parameters.operation !== 'createBot') {
				assert.equal(node.retryOnFail, true, `${name}: artifact reads must retry transient/rate-limit failures`);
			}
		}
		for (const targets of Object.values(workflow.connections)) {
			for (const output of targets.main ?? []) {
				for (const connection of output)
					assert.ok(nodeNames.has(connection.node), `${name} has a connection to a missing node`);
			}
		}
	}
});

test('templates model MeetStream event and artifact semantics correctly', async () => {
	const calendar = JSON.parse(await readFile(new URL('../templates/01-calendar-auto-join.json', import.meta.url)));
	const createCalendarBot = calendar.nodes.find((node) => node.type === 'n8n-nodes-meetstream.meetStream');
	assert.equal(createCalendarBot.parameters.operation, 'createBot');
	assert.equal(createCalendarBot.parameters.transcriptionMode, 'postCall');
	assert.match(createCalendarBot.parameters.deduplicationKey, /deduplicationKey/);

	const crm = await readFile(new URL('../templates/02-transcript-to-crm.json', import.meta.url), 'utf8');
	assert.match(crm, /transcription\.processed/);
	assert.match(crm, /hubspot_contact_id/);
	assert.match(crm, /status === 'Success'/);
	assert.match(crm, /transcript_status !== 'Success'/);

	const live = JSON.parse(await readFile(new URL('../templates/03-live-transcript-llm.json', import.meta.url)));
	const createLiveBot = live.nodes.find((node) => node.name === 'Create live transcription bot');
	assert.equal(createLiveBot.parameters.transcriptionMode, 'live');
	assert.equal(createLiveBot.parameters.liveProvider, 'deepgram_streaming');
	assert.match(createLiveBot.parameters.idempotencyKey, /\$execution\.id/);
	assert.equal(createLiveBot.retryOnFail, true);
	assert.match(JSON.stringify(live), /end_of_turn/);

	const recap = await readFile(new URL('../templates/04-post-meeting-recap.json', import.meta.url), 'utf8');
	assert.match(recap, /transcription\.processed/);
	assert.match(recap, /Get transcript/);
	assert.match(recap, /Summarize completed meeting/);
	assert.doesNotMatch(recap, /getSummary/);

	const storage = await readFile(new URL('../templates/05-recording-to-storage.json', import.meta.url), 'utf8');
	assert.match(storage, /video\.processed/);
	assert.match(storage, /video_status !== 'Success'/);
	assert.match(storage, /responseFormat[^}]*file/);
});
