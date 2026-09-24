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
		getNodeParameter: (name, _itemIndex, fallback) => parameters[name] ?? fallback,
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
			body: {
				meeting_link: 'https://meet.google.com/abc-defg-hij',
				bot_name: 'Recorder',
				video_required: true,
			},
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

test('Create Bot supports scheduling, callbacks, correlation, and post-call transcription', async () => {
	let captured;
	const node = new MeetStream();
	await node.execute.call(
		executionContext(
			{
				operation: 'createBot',
				meetingLink: 'https://meet.google.com/abc-defg-hij',
				botName: 'Calendar Recorder',
				videoRequired: false,
				callbackUrl: 'https://n8n.example/webhook/meetstream-events',
				joinAt: '2026-10-01T10:00:00.000Z',
				deduplicationKey: 'calendar-event-42',
				idempotencyKey: 'request-42',
				customAttributes: '{"hubspot_contact_id":"123"}',
				transcriptionMode: 'postCall',
				postCallProvider: 'deepgram',
				transcriptionLanguage: 'en',
				providerOptions: '{"paragraphs":false}',
			},
			async (_credential, options) => {
				captured = options;
				return { statusCode: 201, body: { bot_id: 'bot-42' } };
			},
		),
	);
	assert.deepEqual(captured.headers, { 'Idempotency-Key': 'request-42' });
	assert.equal(captured.returnFullResponse, true);
	assert.equal(captured.ignoreHttpStatusErrors, true);
	assert.deepEqual(captured.body, {
		meeting_link: 'https://meet.google.com/abc-defg-hij',
		bot_name: 'Calendar Recorder',
		video_required: false,
		callback_url: 'https://n8n.example/webhook/meetstream-events',
		join_at: '2026-10-01T10:00:00.000Z',
		deduplication_key: 'calendar-event-42',
		custom_attributes: { hubspot_contact_id: '123' },
		recording_config: {
			transcript: {
				provider: {
					deepgram: {
						model: 'nova-3',
						language: 'en',
						punctuate: true,
						smart_format: true,
						diarize: true,
						paragraphs: false,
						numerals: true,
						filler_words: false,
						utterances: true,
						utt_split: 0.8,
						detect_language: false,
					},
				},
			},
		},
	});
});

test('an Idempotency-Key replay response is treated as a successful Create Bot result', async () => {
	const node = new MeetStream();
	const output = await node.execute.call(
		executionContext(
			{
				operation: 'createBot',
				meetingLink: 'https://meet.google.com/abc-defg-hij',
				botName: 'Recorder',
				idempotencyKey: 'stable-request-key',
			},
			async () => ({ statusCode: 507, body: { bot_id: 'existing-bot' } }),
		),
	);
	assert.deepEqual(output, [[{
		json: { bot_id: 'existing-bot' },
		pairedItem: { item: 0 },
	}]]);
});

test('other HTTP errors are not hidden when idempotency handling is enabled', async () => {
	const node = new MeetStream();
	await assert.rejects(
		node.execute.call(
			executionContext(
				{
					operation: 'createBot',
					meetingLink: 'https://meet.google.com/abc-defg-hij',
					botName: 'Recorder',
					idempotencyKey: 'stable-request-key',
				},
				async () => ({ statusCode: 429, body: { message: 'Too many requests' } }),
			),
		),
	);
});

test('Create Bot supports the documented live-transcription request shape', async () => {
	let captured;
	const node = new MeetStream();
	await node.execute.call(
		executionContext(
			{
				operation: 'createBot',
				meetingLink: 'https://zoom.us/j/123456789',
				botName: 'Live Notes',
				transcriptionMode: 'live',
				liveProvider: 'deepgram_streaming',
				liveWebhookUrl: 'https://n8n.example/webhook/meetstream-live',
			},
			async (_credential, options) => {
				captured = options;
				return { bot_id: 'bot-live' };
			},
		),
	);
	assert.deepEqual(captured.body.live_transcription_required, {
		webhook_url: 'https://n8n.example/webhook/meetstream-live',
	});
	assert.deepEqual(captured.body.recording_config.transcript.provider.deepgram_streaming, {
		transcription_mode: 'sentence',
		model: 'nova-2',
		language: 'en',
		punctuate: true,
		smart_format: true,
		endpointing: 300,
		vad_events: true,
		utterance_end_ms: 1000,
		encoding: 'linear16',
		channels: 1,
	});
});

test('top-level array API responses are wrapped in a data property', async () => {
	const node = new MeetStream();
	const output = await node.execute.call(
		executionContext(
			{ operation: 'getTranscript', transcriptId: 'transcript-1', raw: false },
			async () => [{ speaker: 'Alex', transcript: 'Hello' }],
		),
	);
	assert.deepEqual(output, [[{
		json: { data: [{ speaker: 'Alex', transcript: 'Hello' }] },
		pairedItem: { item: 0 },
	}]]);
});

test('invalid, blank, and unsupported inputs fail before an API request', async () => {
	const invalidCases = [
		{ operation: 'createBot', meetingLink: '' },
		{ operation: 'createBot', meetingLink: 'http://meet.google.com/abc-defg-hij' },
		{ operation: 'createBot', meetingLink: 'https://meet.google.com/abc-defg-hij', callbackUrl: 'http://localhost:5678/webhook/test' },
		{ operation: 'createBot', meetingLink: 'https://meet.google.com/abc-defg-hij', joinAt: 'not-a-date' },
		{ operation: 'createBot', meetingLink: 'https://meet.google.com/abc-defg-hij', customAttributes: '[]' },
		{ operation: 'createBot', meetingLink: 'https://meet.google.com/abc-defg-hij', transcriptionMode: 'live', liveWebhookUrl: '' },
		{ operation: 'createBot', meetingLink: 'https://meet.google.com/abc-defg-hij', deduplicationKey: 'line\nbreak' },
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
