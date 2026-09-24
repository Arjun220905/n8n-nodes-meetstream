import type {
	IExecuteFunctions,
	IDataObject,
	INode,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestMethods,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

const baseUrl = 'https://api.meetstream.ai/api/v1';

function isHttpsUrl(value: string): boolean {
	try {
		return new URL(value).protocol === 'https:';
	} catch {
		return false;
	}
}

function parseObject(
	value: unknown,
	fieldName: string,
	node: INode,
	itemIndex: number,
): Record<string, unknown> {
	if (value === undefined || value === null || value === '') return {};
	let parsed = value;
	if (typeof value === 'string') {
		try {
			parsed = JSON.parse(value);
		} catch {
			throw new NodeOperationError(node, `${fieldName} must be valid JSON`, { itemIndex });
		}
	}
	if (typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new NodeOperationError(node, `${fieldName} must be a JSON object`, { itemIndex });
	}
	return parsed as Record<string, unknown>;
}

function validateOptionalHttpsUrl(value: string, fieldName: string, node: INode, itemIndex: number): void {
	if (value !== '' && !isHttpsUrl(value)) {
		throw new NodeOperationError(node, `${fieldName} must be a valid HTTPS URL`, { itemIndex });
	}
}

function validateDeduplicationKey(value: string, fieldName: string, node: INode, itemIndex: number): void {
	if (value === '') return;
	if (value.length > 2000 || !/^[\x20-\x7E]+$/.test(value)) {
		throw new NodeOperationError(node, `${fieldName} must contain 1–2000 printable ASCII characters`, { itemIndex });
	}
}

function defaultProviderOptions(provider: string, language: string): Record<string, unknown> {
	const options: Record<string, Record<string, unknown>> = {
		meetstream: { language: language || 'auto', translate: false },
		deepgram: {
			model: 'nova-3', language: language || 'en', punctuate: true, smart_format: true,
			diarize: true, paragraphs: true, numerals: true, filler_words: false,
			utterances: true, utt_split: 0.8, detect_language: false,
		},
		assemblyai: {
			speech_models: ['universal-2'], language_code: language || 'en_us', speaker_labels: true,
			punctuate: true, format_text: true, filter_profanity: false, redact_pii: false,
			auto_chapters: false, entity_detection: false,
		},
		jigsawstack: { language: language || 'auto', translate: false, by_speaker: true },
		sarvam: {
			model: 'saaras:v3', language_code: language || 'en-IN', mode: 'transcribe', with_diarization: true,
		},
		meeting_captions: {},
		deepgram_streaming: {
			transcription_mode: 'sentence', model: 'nova-2', language: language || 'en', punctuate: true,
			smart_format: true, endpointing: 300, vad_events: true, utterance_end_ms: 1000,
			encoding: 'linear16', channels: 1,
		},
		assemblyai_streaming: {
			transcription_mode: 'raw', sample_rate: 48000,
			speech_model: 'universal-streaming-english', format_turns: false, encoding: 'pcm_s16le',
			vad_threshold: '0.4', end_of_turn_confidence_threshold: '0.4', inactivity_timeout: 300,
			min_end_of_turn_silence_when_confident: '400', max_turn_silence: '1280',
		},
	};
	return options[provider] ?? {};
}

export class MeetStream implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MeetStream',
		name: 'meetStream',
		icon: { light: 'file:meetstream.svg', dark: 'file:meetstream-dark.svg' },
		group: ['transform'],
		version: 1,
		description: 'Create, schedule, and retrieve MeetStream meeting-bot artifacts',
		subtitle: '={{$parameter["resource"]}}: {{$parameter["operation"]}}',
		defaults: { name: 'MeetStream' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'meetStreamApi', required: true }],
		properties: [
			{
				displayName: 'Resource', name: 'resource', type: 'options', noDataExpression: true,
				options: [{ name: 'Bot', value: 'bot' }, { name: 'Transcript', value: 'transcript' }], default: 'bot',
			},
			{
				displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true,
				displayOptions: { show: { resource: ['bot'] } },
				options: [
					{ name: 'Create Bot', value: 'createBot', action: 'Send a bot to a meeting' },
					{ name: 'Get Bot', value: 'getBot', action: 'Get the full bot record' },
					{ name: 'Get Recording', value: 'getRecording', action: 'Get the processed video recording' },
					{
						name: 'Get Summary', value: 'getSummary', action: 'Get the ai generated meeting summary',
						description: 'Returns a summary only after MeetStream has generated one. A 404 means no summary is available for this bot.',
					},
					{ name: 'Get Transcriptions', value: 'getTranscriptions', action: 'Get post call transcription runs' },
					{ name: 'Leave Meeting', value: 'removeBot', action: 'Make a bot leave while keeping its data' },
				], default: 'createBot',
			},
			{
				displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true,
				displayOptions: { show: { resource: ['transcript'] } },
				options: [{
					name: 'Get Transcript', value: 'getTranscript', action: 'Get a transcript by transcript ID',
					description: 'Requires a post-call transcript ID. Bots using meeting_captions expose caption artifacts instead.',
				}], default: 'getTranscript',
			},
			{ displayName: 'Meeting Link', name: 'meetingLink', type: 'string', default: '', required: true, displayOptions: { show: { resource: ['bot'], operation: ['createBot'] } }, placeholder: 'https://meet.google.com/abc-defg-hij' },
			{ displayName: 'Bot Name', name: 'botName', type: 'string', default: 'MeetStream Notetaker', displayOptions: { show: { resource: ['bot'], operation: ['createBot'] } } },
			{
				displayName: 'Record Video', name: 'videoRequired', type: 'boolean', default: true,
				description: 'Whether MeetStream should record meeting video',
				displayOptions: { show: { resource: ['bot'], operation: ['createBot'] } },
			},
			{
				displayName: 'Transcription Mode', name: 'transcriptionMode', type: 'options', default: 'none',
				options: [
					{ name: 'None', value: 'none' },
					{ name: 'Post-Call', value: 'postCall' },
					{ name: 'Live Webhook', value: 'live' },
				],
				description: 'Whether and when MeetStream should produce a transcript',
				displayOptions: { show: { resource: ['bot'], operation: ['createBot'] } },
			},
			{
				displayName: 'Provider', name: 'postCallProvider', type: 'options', default: 'meetstream',
				options: [
					{ name: 'AssemblyAI', value: 'assemblyai' },
					{ name: 'Deepgram', value: 'deepgram' },
					{ name: 'JigsawStack', value: 'jigsawstack' },
					{ name: 'Meeting Captions', value: 'meeting_captions' },
					{ name: 'MeetStream', value: 'meetstream' },
					{ name: 'Sarvam', value: 'sarvam' },
				],
				displayOptions: { show: { resource: ['bot'], operation: ['createBot'], transcriptionMode: ['postCall'] } },
			},
			{
				displayName: 'Provider', name: 'liveProvider', type: 'options', default: 'deepgram_streaming',
				options: [
					{ name: 'AssemblyAI Streaming', value: 'assemblyai_streaming' },
					{ name: 'Deepgram Streaming', value: 'deepgram_streaming' },
				],
				displayOptions: { show: { resource: ['bot'], operation: ['createBot'], transcriptionMode: ['live'] } },
			},
			{
				displayName: 'Live Transcript Webhook URL', name: 'liveWebhookUrl', type: 'string', default: '', required: true,
				placeholder: 'https://your-n8n.example/webhook/meetstream-live',
				description: 'Public HTTPS endpoint that receives live transcript chunks',
				displayOptions: { show: { resource: ['bot'], operation: ['createBot'], transcriptionMode: ['live'] } },
			},
			{
				displayName: 'Language', name: 'transcriptionLanguage', type: 'string', default: '',
				placeholder: 'en',
				description: 'Optional provider language code. Leave blank to use the provider default.',
				displayOptions: { show: { resource: ['bot'], operation: ['createBot'], transcriptionMode: ['postCall', 'live'] } },
			},
			{
				displayName: 'Provider Options (JSON)', name: 'providerOptions', type: 'json', default: '{}',
				description: 'Optional provider settings that override the documented defaults',
				displayOptions: { show: { resource: ['bot'], operation: ['createBot'], transcriptionMode: ['postCall', 'live'] } },
			},
			{
				displayName: 'Lifecycle Callback URL', name: 'callbackUrl', type: 'string', default: '',
				placeholder: 'https://your-n8n.example/webhook/meetstream-events',
				description: 'Public HTTPS endpoint that receives bot lifecycle and post-call events',
				displayOptions: { show: { resource: ['bot'], operation: ['createBot'] } },
			},
			{
				displayName: 'Join At', name: 'joinAt', type: 'dateTime', default: '',
				description: 'Optional future ISO 8601 time at which the bot should join',
				displayOptions: { show: { resource: ['bot'], operation: ['createBot'] } },
			},
			{
				displayName: 'Deduplication Key', name: 'deduplicationKey', type: 'string', default: '',
				description: 'Stable business identifier that prevents duplicate bots for the same meeting',
				displayOptions: { show: { resource: ['bot'], operation: ['createBot'] } },
			},
			{
				displayName: 'Idempotency Key', name: 'idempotencyKey', type: 'string', default: '',
				description: 'Request identifier to reuse when n8n retries the same Create Bot call',
				displayOptions: { show: { resource: ['bot'], operation: ['createBot'] } },
			},
			{
				displayName: 'Custom Attributes (JSON)', name: 'customAttributes', type: 'json', default: '{}',
				description: 'Metadata echoed in MeetStream webhook payloads for correlation',
				displayOptions: { show: { resource: ['bot'], operation: ['createBot'] } },
			},
			{ displayName: 'Bot ID', name: 'botId', type: 'string', default: '', required: true, displayOptions: { show: { resource: ['bot'], operation: ['getBot', 'getTranscriptions', 'getRecording', 'getSummary', 'removeBot'] } } },
			{ displayName: 'Transcript ID', name: 'transcriptId', type: 'string', default: '', required: true, displayOptions: { show: { resource: ['transcript'], operation: ['getTranscript'] } } },
			{
				displayName: 'Raw Response', name: 'raw', type: 'boolean', default: false,
				description: 'Whether to return the transcription provider response without MeetStream formatting',
				displayOptions: { show: { resource: ['transcript'], operation: ['getTranscript'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				let method: IHttpRequestMethods = 'GET';
				let url = '';
				let body: Record<string, unknown> | undefined;
				let qs: Record<string, boolean> | undefined;
				let headers: Record<string, string> | undefined;
				if (operation === 'createBot') {
					method = 'POST';
					url = '/bots/create_bot';
					const meetingLink = this.getNodeParameter('meetingLink', itemIndex) as string;
					if (meetingLink.trim() === '') throw new NodeOperationError(this.getNode(), 'Meeting Link is required', { itemIndex });
					if (!isHttpsUrl(meetingLink)) throw new NodeOperationError(this.getNode(), 'Meeting Link must be a valid HTTPS URL', { itemIndex });
					const callbackUrl = this.getNodeParameter('callbackUrl', itemIndex, '') as string;
					const joinAt = this.getNodeParameter('joinAt', itemIndex, '') as string;
					const deduplicationKey = this.getNodeParameter('deduplicationKey', itemIndex, '') as string;
					const idempotencyKey = this.getNodeParameter('idempotencyKey', itemIndex, '') as string;
					validateOptionalHttpsUrl(callbackUrl, 'Lifecycle Callback URL', this.getNode(), itemIndex);
					validateDeduplicationKey(deduplicationKey, 'Deduplication Key', this.getNode(), itemIndex);
					validateDeduplicationKey(idempotencyKey, 'Idempotency Key', this.getNode(), itemIndex);
					if (joinAt !== '' && Number.isNaN(Date.parse(joinAt))) {
						throw new NodeOperationError(this.getNode(), 'Join At must be a valid date and time', { itemIndex });
					}

					body = {
						meeting_link: meetingLink,
						bot_name: this.getNodeParameter('botName', itemIndex, 'MeetStream Notetaker'),
						video_required: this.getNodeParameter('videoRequired', itemIndex, true),
					};
					if (callbackUrl !== '') body.callback_url = callbackUrl;
					if (joinAt !== '') body.join_at = joinAt;
					if (deduplicationKey !== '') body.deduplication_key = deduplicationKey;
					if (idempotencyKey !== '') headers = { 'Idempotency-Key': idempotencyKey };

					const customAttributes = parseObject(
						this.getNodeParameter('customAttributes', itemIndex, '{}'), 'Custom Attributes', this.getNode(), itemIndex,
					);
					if (Object.keys(customAttributes).length > 0) body.custom_attributes = customAttributes;

					const transcriptionMode = this.getNodeParameter('transcriptionMode', itemIndex, 'none') as string;
					if (transcriptionMode !== 'none') {
						const provider = transcriptionMode === 'live'
							? this.getNodeParameter('liveProvider', itemIndex, 'deepgram_streaming') as string
							: this.getNodeParameter('postCallProvider', itemIndex, 'meetstream') as string;
						const language = this.getNodeParameter('transcriptionLanguage', itemIndex, '') as string;
						const providerOptions = parseObject(
							this.getNodeParameter('providerOptions', itemIndex, '{}'), 'Provider Options', this.getNode(), itemIndex,
						);
						body.recording_config = {
							transcript: { provider: { [provider]: { ...defaultProviderOptions(provider, language), ...providerOptions } } },
						};
						if (transcriptionMode === 'live') {
							const liveWebhookUrl = this.getNodeParameter('liveWebhookUrl', itemIndex, '') as string;
							validateOptionalHttpsUrl(liveWebhookUrl, 'Live Transcript Webhook URL', this.getNode(), itemIndex);
							if (liveWebhookUrl === '') {
								throw new NodeOperationError(this.getNode(), 'Live Transcript Webhook URL is required', { itemIndex });
							}
							body.live_transcription_required = { webhook_url: liveWebhookUrl };
						}
					}
				} else if (operation === 'getTranscript') {
					const transcriptId = this.getNodeParameter('transcriptId', itemIndex) as string;
					if (transcriptId.trim() === '') throw new NodeOperationError(this.getNode(), 'Transcript ID is required', { itemIndex });
					url = `/transcript/${encodeURIComponent(transcriptId)}/get_transcript`;
					if (this.getNodeParameter('raw', itemIndex) as boolean) qs = { raw: true };
				} else {
					const botIdValue = this.getNodeParameter('botId', itemIndex) as string;
					if (botIdValue.trim() === '') throw new NodeOperationError(this.getNode(), 'Bot ID is required', { itemIndex });
					const botId = encodeURIComponent(botIdValue);
					const endpoints: Record<string, string> = { getBot: 'detail', getTranscriptions: 'transcriptions', getRecording: 'get_video', getSummary: 'summary', removeBot: 'remove_bot' };
					if (!endpoints[operation]) throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`, { itemIndex });
					url = `/bots/${botId}/${endpoints[operation]}`;
				}
				const acceptsIdempotencyReplay = operation === 'createBot' && headers !== undefined;
				const requestOptions: IHttpRequestOptions = {
					method, baseURL: baseUrl, url, body, qs, headers, json: true, timeout: 60_000, allowedDomains: 'api.meetstream.ai',
				};
				if (acceptsIdempotencyReplay) {
					requestOptions.returnFullResponse = true;
					requestOptions.ignoreHttpStatusErrors = true;
				}
				let response = await this.helpers.httpRequestWithAuthentication.call(
					this, 'meetStreamApi', requestOptions,
				);
				if (acceptsIdempotencyReplay) {
					const fullResponse = response as { body: unknown; statusCode: number };
					if (fullResponse.statusCode >= 400 && fullResponse.statusCode !== 507) {
						const error = typeof fullResponse.body === 'object' && fullResponse.body !== null
							? fullResponse.body as JsonObject
							: { message: String(fullResponse.body) };
						throw new NodeApiError(this.getNode(), error, { httpCode: String(fullResponse.statusCode) });
					}
					response = fullResponse.body;
				}
				const json = typeof response === 'object' && response !== null && !Array.isArray(response)
					? response as IDataObject
					: { data: response } as IDataObject;
				returnData.push({ json, pairedItem: { item: itemIndex } });
			} catch (error) {
				if (this.continueOnFail()) returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: itemIndex } });
				else throw new NodeOperationError(this.getNode(), error, { itemIndex });
			}
		}
		return [returnData];
	}
}
