import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { MeetStream } = require('../dist/nodes/MeetStream/MeetStream.node.js');

function executionContext(
	parameters,
	request = async () => ({ ok: true }),
	continueOnFail = false,
) {
	return {
		getInputData: () => [{ json: {} }],
		getNode: () => ({
			name: 'MeetStream',
			type: 'n8n-nodes-meetstream.meetStream',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getNodeParameter: (name) => parameters[name],
		continueOnFail: () => continueOnFail,
		helpers: { httpRequestWithAuthentication: request },
	};
}

test('each MeetStream operation sends the documented request shape', async () => {
	const cases = [
		{
			parameters: {
				operation: 'createBot',
				meetingLink: 'https://meet.google.com/abc-defg-hij',
				botName: 'Recorder',
			},
			method: 'POST',
			url: '/bots/create_bot',
			body: { meeting_link: 'https://meet.google.com/abc-defg-hij', bot_name: 'Recorder' },
		},
		{
			parameters: { operation: 'getBot', botId: 'bot/with spaces' },
			method: 'GET',
			url: '/bots/bot%2Fwith%20spaces/detail',
		},
		{
			parameters: { operation: 'getTranscriptions', botId: 'bot/with spaces' },
			method: 'GET',
			url: '/bots/bot%2Fwith%20spaces/transcriptions',
		},
		{
			parameters: { operation: 'getRecording', botId: 'bot/with spaces' },
			method: 'GET',
			url: '/bots/bot%2Fwith%20spaces/get_video',
		},
		{
			parameters: { operation: 'getSummary', botId: 'bot/with spaces' },
			method: 'GET',
			url: '/bots/bot%2Fwith%20spaces/summary',
		},
		{
			parameters: { operation: 'removeBot', botId: 'bot/with spaces' },
			method: 'GET',
			url: '/bots/bot%2Fwith%20spaces/remove_bot',
		},
		{
			parameters: { operation: 'getTranscript', transcriptId: 'transcript/with spaces', raw: true },
			method: 'GET',
			url: '/transcript/transcript%2Fwith%20spaces/get_transcript',
			qs: { raw: true },
		},
	];

	for (const expected of cases) {
		let captured;
		const node = new MeetStream();
		const output = await node.execute.call(
			executionContext(expected.parameters, async (_credential, options) => {
				captured = options;
				return { success: true };
			}),
		);
		assert.deepEqual(output, [[{ json: { success: true }, pairedItem: { item: 0 } }]]);
		assert.equal(captured.baseURL, 'https://api.meetstream.ai/api/v1');
		assert.equal(captured.allowedDomains, 'api.meetstream.ai');
		assert.equal(captured.timeout, 60_000);
		assert.equal(captured.method, expected.method);
		assert.equal(captured.url, expected.url);
		assert.deepEqual(captured.body, expected.body);
		assert.deepEqual(captured.qs, expected.qs);
	}
});

test('invalid, blank, and unsupported inputs fail before an API request', async () => {
	const invalidCases = [
		{ operation: 'createBot', meetingLink: '' },
		{ operation: 'createBot', meetingLink: 'http://meet.google.com/abc-defg-hij' },
		{ operation: 'getBot', botId: '   ' },
		{ operation: 'getTranscript', transcriptId: '   ' },
		{ operation: 'not-real', botId: 'bot-1' },
	];

	for (const parameters of invalidCases) {
		let requested = false;
		const node = new MeetStream();
		await assert.rejects(
			node.execute.call(
				executionContext(parameters, async () => {
					requested = true;
					return {};
				}),
			),
		);
		assert.equal(requested, false);
	}
});

test('continue on fail returns a paired error item when the API rejects a request', async () => {
	const node = new MeetStream();
	const output = await node.execute.call(
		executionContext(
			{ operation: 'getBot', botId: 'bot-1' },
			async () => {
				throw new Error('MeetStream unavailable');
			},
			true,
		),
	);
	assert.deepEqual(output, [
		[{ json: { error: 'MeetStream unavailable' }, pairedItem: { item: 0 } }],
	]);
});
